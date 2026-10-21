package com.voyager.backend.fuel.responseDTO;

import java.util.List;

import com.voyager.backend.common.Times;
import com.voyager.backend.fuel.FuelLeg;

/** Matches the front end's FuelLeg type. */
public record FuelLegResponse(
        String id,
        String tripId,
        String label,
        double distanceKm,
        double efficiencyL100km,
        long pricePerLitreCents,
        String driverId,
        List<String> riderIds,
        String createdAt
) {
    public static FuelLegResponse from(FuelLeg leg) {
        return new FuelLegResponse(
                leg.getId(),
                leg.getTripId(),
                leg.getLabel(),
                leg.getDistanceKm(),
                leg.getEfficiencyL100km(),
                leg.getPricePerLitreCents(),
                leg.getDriverId(),
                List.copyOf(leg.getRiderIds()),
                Times.iso(leg.getCreatedAt()));
    }
}
