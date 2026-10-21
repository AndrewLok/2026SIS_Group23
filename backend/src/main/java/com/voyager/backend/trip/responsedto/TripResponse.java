package com.voyager.backend.trip.responsedto;

import java.time.Instant;
import java.util.UUID;

import com.voyager.backend.trip.Trip;

// The frontend's Trip type, field for field. Money is whole cents; dates are ISO instants.
// budgetCapCents is extra: the frontend does not show a budget cap yet, and ignores it.

public record TripResponse(
    UUID id,
    String name,
    String destination,
    Instant startDate,
    Instant endDate,
    String inviteCode,
    UUID createdBy,
    String currency,
    int coverHue,
    long allowanceCents,
    double defaultEfficiency,
    int defaultPricePerLitreCents,
    boolean privateDebts,
    Long budgetCapCents
) {
    public static TripResponse from(Trip trip) {
        return new TripResponse(
            trip.getId(),
            trip.getName(),
            trip.getDestination(),
            trip.getStartDate(),
            trip.getEndDate(),
            trip.getInviteCode(),
            trip.getCreatedBy(),
            trip.getCurrency(),
            trip.getCoverHue(),
            trip.getAllowanceCents(),
            trip.getDefaultEfficiency(),
            trip.getDefaultPricePerLitreCents(),
            trip.isPrivateDebts(),
            trip.getBudgetCapCents()
        );
    }
}
