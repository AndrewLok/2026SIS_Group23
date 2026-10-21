package com.voyager.backend.expense;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.voyager.backend.common.ApiException;
import com.voyager.backend.common.Patch;
import com.voyager.backend.common.Times;
import com.voyager.backend.expense.SettlementCalculator.Balance;
import com.voyager.backend.expense.SettlementCalculator.Charge;
import com.voyager.backend.expense.requestDTO.CreateExpenseRequest;
import com.voyager.backend.expense.responseDTO.BalancesResponse;
import com.voyager.backend.expense.responseDTO.ExpenseResponse;
import com.voyager.backend.fuel.FuelLeg;
import com.voyager.backend.fuel.FuelLegRepository;
import com.voyager.backend.trip.TripAccess;

/** Manual expenses and the balances they add up to. Mirrors the front end's services/mock/expenses.ts. */
@Service
public class ExpenseService {

    static final String BLANK_DESCRIPTION = "Say what the money went on.";
    static final String BAD_AMOUNT = "Enter an amount above zero.";
    static final String BAD_PAYER = "Pick someone on the trip.";
    static final String BAD_DATE = "Pick a date.";
    static final String BAD_CATEGORY = "Pick a category.";
    static final String DELETED = "That expense has been deleted.";

    private final ExpenseRepository expenseRepository;
    private final FuelLegRepository fuelLegRepository;
    private final TripAccess access;

    public ExpenseService(ExpenseRepository expenseRepository, FuelLegRepository fuelLegRepository,
                          TripAccess access) {
        this.expenseRepository = expenseRepository;
        this.fuelLegRepository = fuelLegRepository;
        this.access = access;
    }

    /** All expenses on the trip, newest first. */
    @Transactional(readOnly = true)
    public List<ExpenseResponse> list(String callerId, String tripId) {
        access.requireMember(tripId, callerId);
        return expenseRepository.findByTripIdOrderBySpentAtDescCreatedAtDesc(tripId).stream()
                .map(ExpenseResponse::from).toList();
    }

    @Transactional
    public ExpenseResponse create(String callerId, String tripId, CreateExpenseRequest req) {
        access.requireMember(tripId, callerId);
        String description = checkDescription(req.description());
        long amountCents = checkAmount(req.amountCents());
        Set<String> memberIds = access.memberIds(tripId);
        String paidBy = req.paidBy();
        if (paidBy == null || !memberIds.contains(paidBy)) throw ApiException.invalid(BAD_PAYER);
        Instant spentAt = checkDate(req.spentAt());
        ExpenseCategory category = checkCategory(req.category());
        ExpenseSplit split = checkedSplit(ExpenseSplit.fromWire(req.split()), amountCents, paidBy, memberIds);

        Expense expense = new Expense(null, tripId, description, amountCents, paidBy, spentAt, category,
                Expense.MANUAL, null);
        expense.setSplit(split);
        return ExpenseResponse.from(expenseRepository.save(expense));
    }

    /**
     * Changes only the fields in the patch. The split is checked against the expense as it will
     * be afterwards, so lowering the total below what people owe is refused too. Someone already
     * in the split, or already the payer, who has since left the trip still counts.
     */
    @Transactional
    public ExpenseResponse update(String callerId, String expenseId, Patch patch) {
        Expense expense = requireExpense(expenseId, callerId);
        if (expense.isFuel()) {
            throw ApiException.forbidden("This came from a fuel leg. Edit the leg and this updates with it.");
        }
        long amountCents = patch.has("amountCents") ? checkAmount(patch.longValue("amountCents"))
                : expense.getAmountCents();
        Set<String> allowed = access.memberIds(expense.getTripId());
        String paidBy = expense.getPaidBy();
        if (patch.has("paidBy")) {
            paidBy = patch.string("paidBy");
            if (paidBy == null || (!allowed.contains(paidBy) && !paidBy.equals(expense.getPaidBy()))) {
                throw ApiException.invalid(BAD_PAYER);
            }
        }
        ExpenseSplit current = expense.getSplit();
        if (current != null) allowed.addAll(current.memberIds());
        ExpenseSplit next = patch.has("split") ? ExpenseSplit.fromWire(patch.raw("split")) : current;
        ExpenseSplit split = checkedSplit(next, amountCents, paidBy, allowed);

        if (patch.has("description")) expense.setDescription(checkDescription(patch.string("description")));
        expense.setAmountCents(amountCents);
        expense.setPaidBy(paidBy);
        if (patch.has("spentAt")) expense.setSpentAt(checkDate(patch.string("spentAt")));
        if (patch.has("category")) expense.setCategory(checkCategory(patch.string("category")));
        expense.setSplit(split);
        return ExpenseResponse.from(expense);
    }

    @Transactional
    public void delete(String callerId, String expenseId) {
        Expense expense = expenseRepository.findById(expenseId).orElse(null);
        if (expense == null) return; // Already gone, which is what was asked for.
        access.requireMember(expense.getTripId(), callerId);
        if (expense.isFuel()) {
            throw ApiException.forbidden("This came from a fuel leg. Delete the leg to remove it.");
        }
        expenseRepository.delete(expense);
    }

    /**
     * Who owes what on the trip, and the transfers that would settle it. The front end works
     * this out itself from the expense list; this gives the same figures for anything else.
     */
    @Transactional(readOnly = true)
    public BalancesResponse balances(String callerId, String tripId) {
        access.requireMember(tripId, callerId);
        List<String> memberIds = new ArrayList<>(access.memberIds(tripId));
        Map<String, FuelLeg> legs = new LinkedHashMap<>();
        for (FuelLeg leg : fuelLegRepository.findByTripIdOrderByCreatedAtAsc(tripId)) legs.put(leg.getId(), leg);

        List<Charge> charges = new ArrayList<>();
        for (Expense e : expenseRepository.findByTripIdOrderBySpentAtDescCreatedAtDesc(tripId)) {
            charges.add(chargeFor(e, memberIds, legs));
        }
        List<Balance> balances = SettlementCalculator.balances(charges, memberIds);
        return new BalancesResponse(balances, SettlementCalculator.settle(balances));
    }

    /** One expense as the calculator sees it, following lib/balances.ts participantsFor and sharesFor. */
    static Charge chargeFor(Expense e, List<String> memberIds, Map<String, FuelLeg> legs) {
        ExpenseSplit split = e.getSplit();
        if (e.isFuel() && e.getSourceId() != null) {
            FuelLeg leg = legs.get(e.getSourceId());
            if (leg != null && !leg.getRiderIds().isEmpty()) {
                return new Charge(e.getAmountCents(), e.getPaidBy(), leg.getRiderIds());
            }
        } else if (!e.isFuel() && split != null && !split.isEqual()) {
            // The payer carries whatever nobody else does, so the shares always sum to the total.
            Map<String, Long> shares = new TreeMap<>();
            long owed = 0;
            for (Map.Entry<String, Long> entry : new TreeMap<>(split.amounts()).entrySet()) {
                if (entry.getKey().equals(e.getPaidBy()) || entry.getValue() == 0) continue;
                shares.put(entry.getKey(), entry.getValue());
                owed += entry.getValue();
            }
            long leftover = e.getAmountCents() - owed;
            if (leftover != 0) shares.put(e.getPaidBy(), leftover);
            return new Charge(e.getAmountCents(), e.getPaidBy(), shares.keySet(), shares);
        } else if (!e.isFuel() && split != null && !split.userIds().isEmpty()) {
            return new Charge(e.getAmountCents(), e.getPaidBy(), split.userIds());
        }
        return new Charge(e.getAmountCents(), e.getPaidBy(), memberIds);
    }

    /**
     * Check a split against its expense and return it in its stored shape. An exact split drops
     * zero amounts and any figure against the payer, since the payer's share is always whatever
     * is left over. The amounts owed can never add up to more than the total.
     */
    static ExpenseSplit checkedSplit(ExpenseSplit split, long amountCents, String paidBy, Set<String> memberIds) {
        if (split == null) return null;

        if (split.isEqual()) {
            List<String> userIds = new ArrayList<>(new LinkedHashSet<>(split.userIds()));
            if (userIds.isEmpty()) throw ApiException.invalid("Pick at least one person to split it with.");
            if (!memberIds.containsAll(userIds)) {
                throw ApiException.invalid("Everyone sharing it has to be on the trip.");
            }
            return ExpenseSplit.equal(userIds);
        }

        Map<String, Long> amounts = new LinkedHashMap<>();
        long owed = 0;
        for (Map.Entry<String, Long> entry : split.amounts().entrySet()) {
            long cents = entry.getValue();
            if (cents < 0) throw ApiException.invalid("Amounts owed must be zero or more.");
            if (entry.getKey().equals(paidBy) || cents == 0) continue;
            if (!memberIds.contains(entry.getKey())) {
                throw ApiException.invalid("Everyone who owes has to be on the trip.");
            }
            amounts.put(entry.getKey(), cents);
            owed += cents;
        }
        if (owed == 0) throw ApiException.invalid("Enter what at least one person owes.");
        if (owed > amountCents) throw ApiException.invalid("What people owe adds up to more than the total.");
        return ExpenseSplit.exact(amounts);
    }

    private Expense requireExpense(String expenseId, String callerId) {
        Expense expense = expenseRepository.findById(expenseId).orElseThrow(() -> ApiException.notFound(DELETED));
        access.requireMember(expense.getTripId(), callerId);
        return expense;
    }

    private static String checkDescription(String description) {
        String trimmed = description == null ? "" : description.trim();
        if (trimmed.isEmpty()) throw ApiException.invalid(BLANK_DESCRIPTION);
        return trimmed;
    }

    private static long checkAmount(Long amountCents) {
        if (amountCents == null || amountCents <= 0) throw ApiException.invalid(BAD_AMOUNT);
        return amountCents;
    }

    private static Instant checkDate(String spentAt) {
        Instant instant = Times.parse(spentAt, BAD_DATE);
        if (instant == null) throw ApiException.invalid(BAD_DATE);
        return instant;
    }

    private static ExpenseCategory checkCategory(String category) {
        ExpenseCategory parsed = ExpenseCategory.fromWire(category);
        if (parsed == null) throw ApiException.invalid(BAD_CATEGORY);
        return parsed;
    }
}
