package com.voyager.backend.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

public record CreateTripRequest(
    String destination,
    LocalDate startDate,
    LocalDate endDate,
    BigDecimal budgetCap
) {}