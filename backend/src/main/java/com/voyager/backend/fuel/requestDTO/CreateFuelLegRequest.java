package com.voyager.backend.fuel.requestDTO;

import java.util.List;

/** The front end's NewFuelLeg. */
public record CreateFuelLegRequest(
        String label,
        Double distanceKm,
        Double efficiencyL100km,
        Long pricePerLitreCents,
        String driverId,
        List<String> riderIds
) {}
