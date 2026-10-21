package com.voyager.backend.trip.requestdto;

import java.time.Instant;

// Request DTO's describe data coming in from the frontend.
// The variable names must match that of the JSON object being received.
// This record is converted by Java Spring in the controller class.
// Dates are ISO instants such as "2026-11-08T00:00:00.000Z", exactly what the frontend sends.

public record CreateTripRequest(
    String name,
    String destination,
    Instant startDate,
    Instant endDate,
    Long budgetCapCents
) {}
