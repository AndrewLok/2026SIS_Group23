package com.voyager.backend.fuel.responsedto;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import com.voyager.backend.fuel.FuelService.FuelDetail;

// The frontend's FuelLeg type, field for field, plus who added it (so the screen knows whether to
// offer Delete). The cost is not sent: the screen works it out from the three figures with the same
// sum (see FuelCost), and the expense the leg wrote carries the charged amount.

public record FuelLegResponse(
    UUID id,
    UUID tripId,
    String label,
    double distanceKm,
    double efficiencyL100km,
    int pricePerLitreCents,
    UUID driverId,
    List<UUID> riderIds,
    UUID createdBy,
    Instant createdAt
) {
    public static FuelLegResponse from(FuelDetail detail) {
        var leg = detail.leg();
        return new FuelLegResponse(
            leg.getId(),
            leg.getTripId(),
            leg.getLabel(),
            leg.getDistanceKm(),
            leg.getEfficiencyL100km(),
            leg.getPricePerLitreCents(),
            leg.getDriverId(),
            detail.riderIds(),
            leg.getCreatedBy(),
            leg.getCreatedAt()
        );
    }
}
