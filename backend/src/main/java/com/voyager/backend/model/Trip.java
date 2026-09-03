package com.voyager.backend.model;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDate;

@Entity
@Table(name = "trips")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class Trip {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String destination;

    private LocalDate startDate;
    private LocalDate endDate;

    @Column(precision = 10, scale = 2)
    private BigDecimal budgetCap;
}