package com.voyager.backend.trip.requestdto;

import java.math.BigDecimal;
import java.time.LocalDate;

// Request DTO's describe data coming in from the frontend.
// The variable names must match that of the JSON object being received.
// This record is converted by Java Spring in the controller class.

public record CreateTripRequest(
    String destination,
    LocalDate startDate,
    LocalDate endDate,
    BigDecimal budgetCap
) {}
