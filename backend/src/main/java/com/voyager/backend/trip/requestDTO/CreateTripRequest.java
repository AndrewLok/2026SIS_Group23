package com.voyager.backend.trip.requestDTO;

/** Dates are ISO timestamps or null, as the front end's NewTrip sends them. */
public record CreateTripRequest(
        String name,
        String destination,
        String startDate,
        String endDate
) {}
