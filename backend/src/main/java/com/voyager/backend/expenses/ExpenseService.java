package com.voyager.backend.expenses;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.voyager.backend.common.ApiException;
import com.voyager.backend.common.Fields;
import com.voyager.backend.common.Limits;
import com.voyager.backend.trip.Role;
import com.voyager.backend.trip.TripMember;
import com.voyager.backend.trip.TripMemberRepository;
import com.voyager.backend.trip.TripRepository;

// The rules for expenses.
//
//   - Only people on a trip can see its expenses or add to them. For anyone else they do not exist
//     (404), the same way a trip you are not on does not exist.
//   - Everyone on the trip sees every expense. (Whether the settle-up list shows everyone's debts or
//     only your own is a screen setting; the expenses themselves are not hidden.)
//   - Whoever typed an expense in, the person who paid, or the trip's owner, can change or delete
//     it. Nobody else can. One written by a fuel leg (source FUEL) cannot be changed or deleted
//     here at all; it follows its leg.
//   - Money is whole cents, above zero. The person who paid has to be on the trip when it is made.
//   - How it is shared is its split, or nothing (shared evenly by everyone on the trip):
//       EQUAL  evenly between the named people, who all have to be on the trip.
//       EXACT  what each named person owes the payer. Zeros and any figure against the payer are
//              dropped (the payer's share is whatever is left), at least one person has to owe
//              something, and what is owed cannot add up to more than the total.
//   - Someone who leaves the trip does not take their expenses with them, or their share of other
//     people's: they are still owed what they paid, and still owe what they ate. So there is no
//     leave hook; a split may keep naming someone who has since left (but cannot start naming one).
//
// Everything that changes anything first locks the trip's row, like activities and bookings do. That
// is what stops an expense being made with someone in it at the moment they leave.

@Service
public class ExpenseService {

    private static final String NO_SUCH_TRIP = "That trip does not exist.";
    private static final String NO_SUCH_EXPENSE = "That expense has been deleted.";
    private static final String NOT_YOURS_TO_CHANGE =
            "Only the person who added this, the person who paid, or the trip owner, can change it.";
    private static final String NOT_YOURS_TO_DELETE =
            "Only the person who added this, the person who paid, or the trip owner, can delete it.";
    private static final String FUEL_EDIT = "This came from a fuel leg. Edit the leg and this updates with it.";
    private static final String FUEL_DELETE = "This came from a fuel leg. Delete the leg to remove it.";

    // An expense with the people named in its split.
    public record ExpenseDetail(Expense expense, List<ExpenseShare> shares) {}

    // A split as it is checked and stored: the kind, and who is in it. For EQUAL the amounts are
    // null; for EXACT they are what each person owes. Never has the payer or a zero in it.
    private record Split(SplitKind kind, Map<UUID, Long> people) {}

    private record Locked(Expense expense, TripMember me) {}

    private final ExpenseRepository expenses;
    private final ExpenseShareRepository shares;
    private final TripRepository trips;
    private final TripMemberRepository members;

    public ExpenseService(ExpenseRepository expenses, ExpenseShareRepository shares, TripRepository trips,
            TripMemberRepository members) {
        this.expenses = expenses;
        this.shares = shares;
        this.trips = trips;
        this.members = members;
    }

    // Stored times are kept to the microsecond, which is what the database holds.
    private static Instant now() {
        return Instant.now().truncatedTo(ChronoUnit.MICROS);
    }

    /* Looking things up */

    private static ApiException noSuchTrip() {
        return ApiException.notFound(NO_SUCH_TRIP);
    }

    private static ApiException noSuchExpense() {
        return ApiException.notFound(NO_SUCH_EXPENSE);
    }

    private TripMember requireMember(UUID tripId, UUID userId) {
        return members.findByTripIdAndUserId(tripId, userId).orElseThrow(ExpenseService::noSuchTrip);
    }

    // Takes the trip's lock and then checks the person is on it. Must come before any other read.
    private TripMember lockTripAsMember(UUID tripId, UUID userId) {
        trips.findLockedById(tripId).orElseThrow(ExpenseService::noSuchTrip);
        return requireMember(tripId, userId);
    }

    // The same for an existing expense, which is first looked at only for the trip it belongs to.
    private Locked lockExpense(UUID expenseId, UUID userId) {
        UUID tripId = expenses.findTripIdById(expenseId).orElseThrow(ExpenseService::noSuchExpense);
        trips.findLockedById(tripId).orElseThrow(ExpenseService::noSuchExpense);
        TripMember me = members.findByTripIdAndUserId(tripId, userId).orElseThrow(ExpenseService::noSuchExpense);
        Expense expense = expenses.findById(expenseId).orElseThrow(ExpenseService::noSuchExpense);
        return new Locked(expense, me);
    }

    private static void requireAllowed(Expense expense, TripMember me, String message) {
        boolean mine = expense.getCreatedBy().equals(me.getUserId()) || expense.getPaidBy().equals(me.getUserId());
        if (!mine && me.getRole() != Role.OWNER) {
            throw ApiException.forbidden(message);
        }
    }

    private Set<UUID> memberIds(UUID tripId) {
        return members.findByTripId(tripId).stream().map(TripMember::getUserId).collect(Collectors.toSet());
    }

    /* Reading */

    // Newest spending first.
    @Transactional(readOnly = true)
    public List<ExpenseDetail> list(UUID tripId, UUID userId) {
        requireMember(tripId, userId);
        List<Expense> all = expenses.findByTripId(tripId).stream()
                .sorted(Comparator.comparing(Expense::getSpentAt).reversed()
                        .thenComparing(Comparator.comparing(Expense::getCreatedAt).reversed())
                        .thenComparing(Expense::getId))
                .toList();
        if (all.isEmpty()) {
            return List.of();
        }
        Map<UUID, List<ExpenseShare>> byExpense = shares.findByExpenseIdIn(all.stream().map(Expense::getId).toList())
                .stream().collect(Collectors.groupingBy(ExpenseShare::getExpenseId));
        return all.stream().map(e -> detail(e, byExpense.getOrDefault(e.getId(), List.of()))).toList();
    }

    private static ExpenseDetail detail(Expense expense, List<ExpenseShare> rows) {
        List<ExpenseShare> sorted = rows.stream()
                .sorted(Comparator.comparing(s -> s.getUserId().toString()))
                .toList();
        return new ExpenseDetail(expense, sorted);
    }

    /* Changing */

    // The body is a plain map, not a typed request: the same reading of it is then used for making
    // an expense and changing one, and a money figure can be refused for being 12.5 instead of being
    // quietly turned into 12.
    @Transactional
    public ExpenseDetail create(UUID tripId, UUID userId, Map<String, Object> body) {
        lockTripAsMember(tripId, userId);
        Set<UUID> onTheTrip = memberIds(tripId);

        String description = descriptionOf(body.get("description"));
        long amount = amountOf(body.get("amountCents"));
        UUID paidBy = payerOf(body.get("paidBy"), onTheTrip);
        Instant spentAt = spentAtOf(body.get("spentAt"));
        ExpenseCategory category = categoryOf(body.get("category"), ExpenseCategory.OTHER);
        Split split = checkedSplit(body.get("split"), amount, paidBy, onTheTrip);

        Expense saved = expenses.save(new Expense(tripId, description, amount, paidBy, spentAt, category,
                ExpenseSource.MANUAL, null, split == null ? null : split.kind(), userId, now()));
        return new ExpenseDetail(saved, storeSplit(saved.getId(), split));
    }

    // A partial update: send only the fields to change. A split of null puts it back to "everyone,
    // evenly". The split is checked as it will be after the change, so lowering the total below what
    // people owe, or making someone who owes the payer, is refused too.
    @Transactional
    public ExpenseDetail update(UUID expenseId, UUID userId, Map<String, Object> patch) {
        Locked locked = lockExpense(expenseId, userId);
        Expense expense = locked.expense();
        refuseFuel(expense, FUEL_EDIT);
        requireAllowed(expense, locked.me(), NOT_YOURS_TO_CHANGE);

        List<ExpenseShare> currentRows = shares.findByExpenseId(expense.getId());
        Split current = splitOf(expense, currentRows);

        Set<UUID> onTheTrip = memberIds(expense.getTripId());
        // Somebody already in the split who has since left still owes their part, so they may stay.
        Set<UUID> allowed = new HashSet<>(onTheTrip);
        if (current != null) {
            allowed.addAll(current.people().keySet());
        }

        String description = patch.containsKey("description") ? descriptionOf(patch.get("description")) : expense.getDescription();
        long amount = patch.containsKey("amountCents") ? amountOf(patch.get("amountCents")) : expense.getAmountCents();
        UUID paidBy = patch.containsKey("paidBy") ? payerOf(patch.get("paidBy"), onTheTrip) : expense.getPaidBy();
        Instant spentAt = patch.containsKey("spentAt") ? spentAtOf(patch.get("spentAt")) : expense.getSpentAt();
        ExpenseCategory category = patch.containsKey("category")
                ? categoryOf(patch.get("category"), null) : expense.getCategory();
        Split split = patch.containsKey("split")
                ? checkedSplit(patch.get("split"), amount, paidBy, allowed)
                : checkedSplit(current == null ? null : asRaw(current), amount, paidBy, allowed);

        expense.setDescription(description);
        expense.setAmountCents(amount);
        expense.setPaidBy(paidBy);
        expense.setSpentAt(spentAt);
        expense.setCategory(category);
        expense.setSplitKind(split == null ? null : split.kind());
        expenses.save(expense);

        List<ExpenseShare> rows = currentRows;
        if (!sameSplit(current, split)) {
            shares.deleteByExpenseId(expense.getId());
            // The new rows may name people the old ones did; the old ones have to be gone first.
            shares.flush();
            rows = storeSplit(expense.getId(), split);
        }
        return detail(expense, rows);
    }

    @Transactional
    public void remove(UUID expenseId, UUID userId) {
        Locked locked = lockExpense(expenseId, userId);
        refuseFuel(locked.expense(), FUEL_DELETE);
        requireAllowed(locked.expense(), locked.me(), NOT_YOURS_TO_DELETE);
        shares.deleteByExpenseId(expenseId);
        shares.flush();
        expenses.delete(locked.expense());
    }

    private static void refuseFuel(Expense expense, String message) {
        if (expense.getSource() == ExpenseSource.FUEL) {
            throw ApiException.forbidden(message);
        }
    }

    /* Checking what was sent */

    private static String descriptionOf(Object raw) {
        String description = raw == null ? "" : Fields.text(raw, "description").trim();
        if (description.isEmpty()) {
            throw ApiException.invalid("Say what the money went on.");
        }
        if (description.length() > Limits.EXPENSE_DESCRIPTION) {
            throw ApiException.invalid(Limits.tooLong("description", Limits.EXPENSE_DESCRIPTION));
        }
        return description;
    }

    private static long amountOf(Object raw) {
        if (raw == null) {
            throw ApiException.invalid("Enter an amount above zero.");
        }
        long cents = Fields.wholeNumber(raw, "amountCents");
        if (cents <= 0) {
            throw ApiException.invalid("Enter an amount above zero.");
        }
        if (cents > Limits.MAX_EXPENSE_CENTS) {
            throw ApiException.invalid("That amount is too large.");
        }
        return cents;
    }

    private static UUID payerOf(Object raw, Set<UUID> onTheTrip) {
        UUID paidBy = Fields.uuidOrNull(raw);
        if (paidBy == null || !onTheTrip.contains(paidBy)) {
            throw ApiException.invalid("The person who paid has to be on the trip.");
        }
        return paidBy;
    }

    private static Instant spentAtOf(Object raw) {
        if (raw == null) {
            throw ApiException.invalid("Pick a date.");
        }
        return Fields.instant(raw, "spentAt");
    }

    // A missing category is the fallback when there is one (making an expense), an error otherwise.
    private static ExpenseCategory categoryOf(Object raw, ExpenseCategory fallback) {
        if (raw == null && fallback != null) {
            return fallback;
        }
        ExpenseCategory category = raw instanceof String string ? ExpenseCategory.fromWire(string) : null;
        if (category == null) {
            throw ApiException.invalid("Pick a category: food, transport, tickets, stay or other.");
        }
        return category;
    }

    // Checks a split against its expense and returns it as it will be stored, or null for "shared
    // evenly by everyone". `allowed` is who may be named in it.
    private static Split checkedSplit(Object raw, long amount, UUID paidBy, Set<UUID> allowed) {
        if (raw == null) {
            return null;
        }
        if (!(raw instanceof Map<?, ?> map)) {
            throw ApiException.invalid("split has to be an object like {\"kind\":\"equal\",\"userIds\":[...]}.");
        }
        SplitKind kind = map.get("kind") instanceof String name ? SplitKind.fromWire(name) : null;
        if (kind == null) {
            throw ApiException.invalid("Pick how to split it: equally, or exact amounts.");
        }

        if (kind == SplitKind.EQUAL) {
            if (!(map.get("userIds") instanceof List<?> ids)) {
                throw ApiException.invalid("userIds has to be a list of people.");
            }
            Map<UUID, Long> people = new LinkedHashMap<>();
            for (Object id : ids) {
                UUID person = Fields.uuidOrNull(id);
                if (person == null || !allowed.contains(person)) {
                    throw ApiException.invalid("Everyone sharing it has to be on the trip.");
                }
                people.put(person, null);
            }
            if (people.isEmpty()) {
                throw ApiException.invalid("Pick at least one person to split it with.");
            }
            return new Split(SplitKind.EQUAL, people);
        }

        if (!(map.get("amounts") instanceof Map<?, ?> amounts)) {
            throw ApiException.invalid("amounts has to be what each person owes.");
        }
        Map<UUID, Long> people = new LinkedHashMap<>();
        long owed = 0;
        for (Map.Entry<?, ?> entry : amounts.entrySet()) {
            long cents = Fields.wholeNumber(entry.getValue(), "An amount owed");
            if (cents < 0) {
                throw ApiException.invalid("Amounts owed must be zero or more.");
            }
            UUID person = Fields.uuidOrNull(entry.getKey());
            if ((person != null && person.equals(paidBy)) || cents == 0) {
                continue;
            }
            if (person == null || !allowed.contains(person)) {
                throw ApiException.invalid("Everyone who owes has to be on the trip.");
            }
            // One figure over the total is already too much, and stops the sum overflowing.
            if (cents > amount || owed + cents > amount) {
                throw ApiException.invalid("What people owe adds up to more than the total.");
            }
            owed += cents;
            people.put(person, cents);
        }
        if (people.isEmpty()) {
            throw ApiException.invalid("Enter what at least one person owes.");
        }
        return new Split(SplitKind.EXACT, people);
    }

    /* The split, stored and read back */

    private static Split splitOf(Expense expense, List<ExpenseShare> rows) {
        if (expense.getSplitKind() == null) {
            return null;
        }
        Map<UUID, Long> people = new LinkedHashMap<>();
        for (ExpenseShare row : rows) {
            people.put(row.getUserId(), row.getCents());
        }
        return new Split(expense.getSplitKind(), people);
    }

    // A split in the shape a request has it, so that an unchanged one can be checked again with the
    // same code as a new one.
    private static Object asRaw(Split split) {
        Map<String, Object> raw = new LinkedHashMap<>();
        raw.put("kind", split.kind().wire());
        if (split.kind() == SplitKind.EQUAL) {
            raw.put("userIds", new ArrayList<Object>(split.people().keySet().stream().map(UUID::toString).toList()));
        } else {
            Map<String, Object> amounts = new LinkedHashMap<>();
            split.people().forEach((id, cents) -> amounts.put(id.toString(), cents));
            raw.put("amounts", amounts);
        }
        return raw;
    }

    private static boolean sameSplit(Split a, Split b) {
        return a == null ? b == null : a.equals(b);
    }

    private List<ExpenseShare> storeSplit(UUID expenseId, Split split) {
        if (split == null) {
            return List.of();
        }
        List<ExpenseShare> rows = new ArrayList<>();
        for (Map.Entry<UUID, Long> person : split.people().entrySet()) {
            rows.add(new ExpenseShare(expenseId, person.getKey(), person.getValue()));
        }
        return shares.saveAll(rows).stream()
                .sorted(Comparator.comparing(s -> s.getUserId().toString()))
                .toList();
    }
}
