package com.voyager.backend.fuel;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashSet;
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
import com.voyager.backend.expenses.Expense;
import com.voyager.backend.expenses.ExpenseCategory;
import com.voyager.backend.expenses.ExpenseRepository;
import com.voyager.backend.expenses.ExpenseSource;
import com.voyager.backend.trip.Role;
import com.voyager.backend.trip.Trip;
import com.voyager.backend.trip.TripMember;
import com.voyager.backend.trip.TripMemberRepository;
import com.voyager.backend.trip.TripRepository;

// The rules for fuel legs.
//
//   - Only people on a trip can see its legs or add to them. For anyone else they do not exist (404).
//   - Everyone on the trip sees every leg.
//   - A leg is one drive: a distance, how thirsty the car is, a price per litre, the person who pays
//     at the pump (the driver) and the people who rode. Its cost is worked out here (FuelCost) and
//     is shared evenly between the riders, which is done by the frontend's balances like any split.
//   - Every leg has an expense (source FUEL) for that cost, paid by the driver. It is written, kept
//     in step and removed here, in the same transaction as the leg, so there is never one without the
//     other. The expense cannot be touched on its own (ExpenseService refuses).
//   - The driver and the riders have to be on the trip when the leg is made or changed, and there
//     has to be at least one rider. A leg has to cost something.
//   - Whoever added a leg, the driver, or the trip's owner, can change or delete it.
//   - Someone who leaves does not take their legs with them, or their share of other people's: as with
//     expenses, they are still owed what they paid at the pump and still owe what they rode. A leg may
//     keep naming someone who has since left, but cannot start naming one.
//   - Making a leg remembers its efficiency and price as the trip's defaults, so the next form starts
//     with them.
//
// Everything that changes anything first locks the trip's row, like activities, bookings and
// expenses do.

@Service
public class FuelService {

    private static final String NO_SUCH_TRIP = "That trip does not exist.";
    private static final String NO_SUCH_LEG = "That leg has been deleted.";
    private static final String NOT_YOURS_TO_CHANGE =
            "Only the person who added this, the driver, or the trip owner, can change it.";
    private static final String NOT_YOURS_TO_DELETE =
            "Only the person who added this, the driver, or the trip owner, can delete it.";

    // A leg with the people who rode on it.
    public record FuelDetail(FuelLeg leg, List<UUID> riderIds) {}

    private record Locked(FuelLeg leg, TripMember me) {}

    private final FuelLegRepository legs;
    private final FuelRiderRepository riders;
    private final ExpenseRepository expenses;
    private final TripRepository trips;
    private final TripMemberRepository members;

    public FuelService(FuelLegRepository legs, FuelRiderRepository riders, ExpenseRepository expenses,
            TripRepository trips, TripMemberRepository members) {
        this.legs = legs;
        this.riders = riders;
        this.expenses = expenses;
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

    private static ApiException noSuchLeg() {
        return ApiException.notFound(NO_SUCH_LEG);
    }

    private TripMember requireMember(UUID tripId, UUID userId) {
        return members.findByTripIdAndUserId(tripId, userId).orElseThrow(FuelService::noSuchTrip);
    }

    // Takes the trip's lock and then checks the person is on it. Must come before any other read.
    private Trip lockTripAsMember(UUID tripId, UUID userId) {
        Trip trip = trips.findLockedById(tripId).orElseThrow(FuelService::noSuchTrip);
        requireMember(tripId, userId);
        return trip;
    }

    // The same for an existing leg, which is first looked at only for the trip it belongs to.
    private Locked lockLeg(UUID legId, UUID userId) {
        UUID tripId = legs.findTripIdById(legId).orElseThrow(FuelService::noSuchLeg);
        trips.findLockedById(tripId).orElseThrow(FuelService::noSuchLeg);
        TripMember me = members.findByTripIdAndUserId(tripId, userId).orElseThrow(FuelService::noSuchLeg);
        FuelLeg leg = legs.findById(legId).orElseThrow(FuelService::noSuchLeg);
        return new Locked(leg, me);
    }

    private static void requireAllowed(FuelLeg leg, TripMember me, String message) {
        boolean mine = leg.getCreatedBy().equals(me.getUserId()) || leg.getDriverId().equals(me.getUserId());
        if (!mine && me.getRole() != Role.OWNER) {
            throw ApiException.forbidden(message);
        }
    }

    private Set<UUID> memberIds(UUID tripId) {
        return members.findByTripId(tripId).stream().map(TripMember::getUserId).collect(Collectors.toSet());
    }

    /* Reading */

    // In the order they were made.
    @Transactional(readOnly = true)
    public List<FuelDetail> list(UUID tripId, UUID userId) {
        requireMember(tripId, userId);
        List<FuelLeg> all = legs.findByTripId(tripId).stream()
                .sorted(Comparator.comparing(FuelLeg::getCreatedAt).thenComparing(FuelLeg::getId))
                .toList();
        if (all.isEmpty()) {
            return List.of();
        }
        Map<UUID, List<FuelRider>> byLeg = riders.findByLegIdIn(all.stream().map(FuelLeg::getId).toList())
                .stream().collect(Collectors.groupingBy(FuelRider::getLegId));
        return all.stream().map(l -> detail(l, byLeg.getOrDefault(l.getId(), List.of()))).toList();
    }

    private static FuelDetail detail(FuelLeg leg, List<FuelRider> rows) {
        return new FuelDetail(leg, rows.stream().map(FuelRider::getUserId).map(UUID::toString).sorted()
                .map(UUID::fromString).toList());
    }

    /* Changing */

    // The body is a plain map, like an expense's, so that the figures are read strictly and in one
    // place for making a leg and for changing one.
    @Transactional
    public FuelDetail create(UUID tripId, UUID userId, Map<String, Object> body) {
        Trip trip = lockTripAsMember(tripId, userId);
        Set<UUID> onTheTrip = memberIds(tripId);

        String label = labelOf(body.get("label"));
        double distance = distanceOf(body.get("distanceKm"));
        double efficiency = efficiencyOf(body.get("efficiencyL100km"));
        int price = priceOf(body.get("pricePerLitreCents"));
        UUID driver = driverOf(body.get("driverId"), onTheTrip);
        Set<UUID> riderIds = ridersOf(body.get("riderIds"), onTheTrip);
        long cost = costOf(distance, efficiency, price);

        Instant at = now();
        FuelLeg leg = legs.save(new FuelLeg(tripId, label, distance, efficiency, price, driver, userId, at));
        List<UUID> stored = storeRiders(leg.getId(), riderIds);
        expenses.save(new Expense(tripId, describe(label), cost, driver, at, ExpenseCategory.TRANSPORT,
                ExpenseSource.FUEL, leg.getId().toString(), null, userId, at));

        // The next form starts from what this one used.
        trip.setDefaultEfficiency(efficiency);
        trip.setDefaultPricePerLitreCents(price);
        trips.save(trip);

        return new FuelDetail(leg, stored);
    }

    // A partial update: send only the fields to change. The expense follows the leg.
    @Transactional
    public FuelDetail update(UUID legId, UUID userId, Map<String, Object> patch) {
        Locked locked = lockLeg(legId, userId);
        FuelLeg leg = locked.leg();
        requireAllowed(leg, locked.me(), NOT_YOURS_TO_CHANGE);

        List<FuelRider> currentRows = riders.findByLegId(leg.getId());
        Set<UUID> current = currentRows.stream().map(FuelRider::getUserId).collect(Collectors.toCollection(LinkedHashSet::new));
        Set<UUID> onTheTrip = memberIds(leg.getTripId());
        // Somebody who already rode and has since left still owes their part, so they may stay.
        Set<UUID> allowed = new HashSet<>(onTheTrip);
        allowed.addAll(current);

        String label = patch.containsKey("label") ? labelOf(patch.get("label")) : leg.getLabel();
        double distance = patch.containsKey("distanceKm") ? distanceOf(patch.get("distanceKm")) : leg.getDistanceKm();
        double efficiency = patch.containsKey("efficiencyL100km")
                ? efficiencyOf(patch.get("efficiencyL100km")) : leg.getEfficiencyL100km();
        int price = patch.containsKey("pricePerLitreCents")
                ? priceOf(patch.get("pricePerLitreCents")) : leg.getPricePerLitreCents();
        UUID driver = patch.containsKey("driverId") ? driverOf(patch.get("driverId"), onTheTrip) : leg.getDriverId();
        Set<UUID> riderIds = patch.containsKey("riderIds") ? ridersOf(patch.get("riderIds"), allowed) : current;
        long cost = costOf(distance, efficiency, price);

        leg.setLabel(label);
        leg.setDistanceKm(distance);
        leg.setEfficiencyL100km(efficiency);
        leg.setPricePerLitreCents(price);
        leg.setDriverId(driver);
        legs.save(leg);

        List<UUID> stored = current.stream().map(UUID::toString).sorted().map(UUID::fromString).toList();
        if (!current.equals(riderIds)) {
            riders.deleteByLegId(leg.getId());
            // The new rows may name people the old ones did; the old ones have to be gone first.
            riders.flush();
            stored = storeRiders(leg.getId(), riderIds);
        }

        Expense expense = expenses.findBySourceAndSourceId(ExpenseSource.FUEL, leg.getId().toString())
                .orElseGet(() -> new Expense(leg.getTripId(), describe(leg.getLabel()), cost, driver, leg.getCreatedAt(),
                        ExpenseCategory.TRANSPORT, ExpenseSource.FUEL, leg.getId().toString(), null,
                        leg.getCreatedBy(), now()));
        expense.setDescription(describe(label));
        expense.setAmountCents(cost);
        expense.setPaidBy(driver);
        expenses.save(expense);

        return new FuelDetail(leg, stored);
    }

    @Transactional
    public void remove(UUID legId, UUID userId) {
        Locked locked = lockLeg(legId, userId);
        requireAllowed(locked.leg(), locked.me(), NOT_YOURS_TO_DELETE);
        expenses.findBySourceAndSourceId(ExpenseSource.FUEL, legId.toString()).ifPresent(expenses::delete);
        riders.deleteByLegId(legId);
        riders.flush();
        legs.delete(locked.leg());
    }

    private static String describe(String label) {
        return "Fuel: " + label;
    }

    private List<UUID> storeRiders(UUID legId, Set<UUID> riderIds) {
        List<FuelRider> rows = new ArrayList<>();
        for (UUID rider : riderIds) {
            rows.add(new FuelRider(legId, rider));
        }
        return riders.saveAll(rows).stream().map(FuelRider::getUserId).map(UUID::toString).sorted()
                .map(UUID::fromString).toList();
    }

    /* Checking what was sent */

    private static String labelOf(Object raw) {
        String label = raw == null ? "" : Fields.text(raw, "label").trim();
        if (label.isEmpty()) {
            throw ApiException.invalid("Name the leg, like \"Lorne to Apollo Bay\".");
        }
        if (label.length() > Limits.FUEL_LABEL) {
            throw ApiException.invalid(Limits.tooLong("label", Limits.FUEL_LABEL));
        }
        return label;
    }

    private static double distanceOf(Object raw) {
        double km = raw == null ? 0 : Fields.decimal(raw, "distanceKm");
        if (km <= 0) {
            throw ApiException.invalid("Enter a distance above zero.");
        }
        if (km > Limits.MAX_FUEL_KM) {
            throw ApiException.invalid("That distance is too long.");
        }
        return km;
    }

    private static double efficiencyOf(Object raw) {
        double e = raw == null ? 0 : Fields.decimal(raw, "efficiencyL100km");
        if (e <= 0) {
            throw ApiException.invalid("Enter litres per 100 km.");
        }
        if (e > Limits.MAX_FUEL_EFFICIENCY) {
            throw ApiException.invalid("That is more than " + (int) Limits.MAX_FUEL_EFFICIENCY + " litres per 100 km.");
        }
        return e;
    }

    // Whole cents per litre, as a trip's default is.
    private static int priceOf(Object raw) {
        if (raw == null) {
            throw ApiException.invalid("Enter cents per litre.");
        }
        double p = Fields.decimal(raw, "pricePerLitreCents");
        if (p != Math.rint(p)) {
            throw ApiException.invalid("Enter whole cents per litre.");
        }
        if (p <= 0) {
            throw ApiException.invalid("Enter cents per litre.");
        }
        if (p > Limits.MAX_FUEL_PRICE_CENTS) {
            throw ApiException.invalid("That price per litre is too high.");
        }
        return (int) p;
    }

    private static UUID driverOf(Object raw, Set<UUID> onTheTrip) {
        UUID driver = Fields.uuidOrNull(raw);
        if (driver == null || !onTheTrip.contains(driver)) {
            throw ApiException.invalid("The driver has to be on the trip.");
        }
        return driver;
    }

    private static Set<UUID> ridersOf(Object raw, Set<UUID> allowed) {
        if (raw == null) {
            throw ApiException.invalid("Pick at least one person to chip in.");
        }
        if (!(raw instanceof List<?> list)) {
            throw ApiException.invalid("riderIds has to be a list of people.");
        }
        Set<UUID> people = new LinkedHashSet<>();
        for (Object item : list) {
            UUID person = Fields.uuidOrNull(item);
            if (person == null || !allowed.contains(person)) {
                throw ApiException.invalid("Everyone chipping in has to be on the trip.");
            }
            people.add(person);
        }
        if (people.isEmpty()) {
            throw ApiException.invalid("Pick at least one person to chip in.");
        }
        return people;
    }

    // The leg's cost, which also becomes an expense, and an expense has to be above zero.
    private static long costOf(double distance, double efficiency, int price) {
        long cost = FuelCost.costCents(distance, efficiency, price);
        if (cost <= 0) {
            throw ApiException.invalid("That leg costs nothing. Check the distance, litres and price.");
        }
        if (cost > Limits.MAX_EXPENSE_CENTS) {
            throw ApiException.invalid("That leg costs too much.");
        }
        return cost;
    }
}
