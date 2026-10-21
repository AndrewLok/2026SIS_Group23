package com.voyager.backend.trip.responseDTO;

import com.voyager.backend.common.Times;
import com.voyager.backend.trip.Trip;

/** Matches the front end's Trip type. */
public record TripResponse(
        String id,
        String name,
        String destination,
        String startDate,
        String endDate,
        String inviteCode,
        String createdBy,
        String currency,
        int coverHue,
        long allowanceCents,
        double defaultEfficiency,
        long defaultPricePerLitreCents,
        boolean privateDebts
) {
    public static TripResponse from(Trip trip) {
        return new TripResponse(
                trip.getId(),
                trip.getName(),
                trip.getDestination(),
                Times.iso(trip.getStartDate()),
                Times.iso(trip.getEndDate()),
                trip.getInviteCode(),
                trip.getCreatedBy(),
                trip.getCurrency(),
                trip.getCoverHue(),
                trip.getAllowanceCents(),
                trip.getDefaultEfficiency(),
                trip.getDefaultPricePerLitreCents(),
                trip.isPrivateDebts());
    }
}
