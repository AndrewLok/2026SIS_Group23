package com.voyager.backend.fuel;

import java.time.Instant;
import java.util.List;
import java.util.Set;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.voyager.backend.common.ApiException;
import com.voyager.backend.common.Patch;
import com.voyager.backend.expense.Expense;
import com.voyager.backend.expense.ExpenseCategory;
import com.voyager.backend.expense.ExpenseRepository;
import com.voyager.backend.fuel.requestDTO.CreateFuelLegRequest;
import com.voyager.backend.fuel.responseDTO.FuelLegResponse;
import com.voyager.backend.trip.Trip;
import com.voyager.backend.trip.TripAccess;

/**
 * Fuel legs, and the expense each one writes through to. Mirrors the front end's
 * services/mock/fuel.ts: the expenses screen treats that expense as read only and links here.
 */
@Service
public class FuelService {

    private static final String DELETED = "That leg has been deleted.";

    private final FuelLegRepository legRepository;
    private final ExpenseRepository expenseRepository;
    private final TripAccess access;

    public FuelService(FuelLegRepository legRepository, ExpenseRepository expenseRepository, TripAccess access) {
        this.legRepository = legRepository;
        this.expenseRepository = expenseRepository;
        this.access = access;
    }

    static String describe(String label) {
        return "Fuel: " + label;
    }

    @Transactional(readOnly = true)
    public List<FuelLegResponse> list(String callerId, String tripId) {
        access.requireMember(tripId, callerId);
        return legRepository.findByTripIdOrderByCreatedAtAsc(tripId).stream().map(FuelLegResponse::from).toList();
    }

    @Transactional
    public FuelLegResponse create(String callerId, String tripId, CreateFuelLegRequest req) {
        Trip trip = access.requireMember(tripId, callerId);
        String label = checkLabel(req.label());
        double distanceKm = checkDistance(req.distanceKm());
        double efficiency = checkEfficiency(req.efficiencyL100km());
        long price = checkPrice(req.pricePerLitreCents());
        List<String> riders = checkRiders(req.riderIds());
        Set<String> memberIds = access.memberIds(tripId);
        if (req.driverId() == null || !memberIds.contains(req.driverId())) {
            throw ApiException.invalid("Pick who is driving.");
        }
        if (!memberIds.containsAll(riders)) throw ApiException.invalid("Everyone chipping in has to be on the trip.");

        Instant now = Instant.now();
        FuelLeg leg = legRepository.save(new FuelLeg(null, tripId, label, distanceKm, efficiency, price,
                req.driverId(), riders, now));
        expenseRepository.save(new Expense(null, tripId, describe(label), leg.costCents(), leg.getDriverId(), now,
                ExpenseCategory.TRANSPORT, Expense.FUEL, leg.getId()));

        // Remember the defaults so the next leg's form is not empty.
        trip.setDefaultEfficiency(efficiency);
        trip.setDefaultPricePerLitreCents(price);
        return FuelLegResponse.from(leg);
    }

    @Transactional
    public FuelLegResponse update(String callerId, String legId, Patch patch) {
        FuelLeg leg = legRepository.findById(legId).orElseThrow(() -> ApiException.notFound(DELETED));
        access.requireMember(leg.getTripId(), callerId);
        // Someone already on the leg who has since left can stay on it.
        Set<String> allowed = access.memberIds(leg.getTripId());
        allowed.addAll(leg.getRiderIds());
        allowed.add(leg.getDriverId());

        if (patch.has("label")) leg.setLabel(checkLabel(patch.string("label")));
        if (patch.has("distanceKm")) leg.setDistanceKm(checkDistance(patch.doubleValue("distanceKm")));
        if (patch.has("efficiencyL100km")) leg.setEfficiencyL100km(checkEfficiency(patch.doubleValue("efficiencyL100km")));
        if (patch.has("pricePerLitreCents")) leg.setPricePerLitreCents(checkPrice(patch.longValue("pricePerLitreCents")));
        if (patch.has("driverId")) {
            String driverId = patch.string("driverId");
            if (driverId == null || !allowed.contains(driverId)) throw ApiException.invalid("Pick who is driving.");
            leg.setDriverId(driverId);
        }
        if (patch.has("riderIds")) {
            List<String> riders = checkRiders(patch.strings("riderIds"));
            if (!allowed.containsAll(riders)) throw ApiException.invalid("Everyone chipping in has to be on the trip.");
            leg.setRiderIds(riders);
        }

        // Keep the written-through expense in step with the leg.
        expenseRepository.findBySourceAndSourceId(Expense.FUEL, leg.getId()).ifPresent(expense -> {
            expense.setDescription(describe(leg.getLabel()));
            expense.setAmountCents(leg.costCents());
            expense.setPaidBy(leg.getDriverId());
        });
        return FuelLegResponse.from(leg);
    }

    @Transactional
    public void remove(String callerId, String legId) {
        FuelLeg leg = legRepository.findById(legId).orElse(null);
        if (leg == null) return; // Already gone, which is what was asked for.
        access.requireMember(leg.getTripId(), callerId);
        expenseRepository.findBySourceAndSourceId(Expense.FUEL, leg.getId()).ifPresent(expenseRepository::delete);
        legRepository.delete(leg);
    }

    private static String checkLabel(String label) {
        String trimmed = label == null ? "" : label.trim();
        if (trimmed.isEmpty()) throw ApiException.invalid("Name the leg, like \"Lorne to Apollo Bay\".");
        return trimmed;
    }

    private static double checkDistance(Double km) {
        if (km == null || !(km > 0)) throw ApiException.invalid("Enter a distance above zero.");
        return km;
    }

    private static double checkEfficiency(Double value) {
        if (value == null || !(value > 0)) throw ApiException.invalid("Enter the car's fuel use above zero.");
        return value;
    }

    private static long checkPrice(Long value) {
        if (value == null || value <= 0) throw ApiException.invalid("Enter a fuel price above zero.");
        return value;
    }

    private static List<String> checkRiders(List<String> riders) {
        if (riders == null || riders.isEmpty()) throw ApiException.invalid("Pick at least one person to chip in.");
        return riders.stream().distinct().toList();
    }
}
