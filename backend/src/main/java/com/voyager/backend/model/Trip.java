package com.voyager.backend.model;

import java.math.BigDecimal;
import java.time.LocalDate;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "trips")
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

    @Column(unique = true)
    private String joinCode;

    public Trip() {}

    public Trip(String destination, LocalDate startDate, LocalDate endDate, BigDecimal budgetCap, String joinCode) {
        this.destination = destination;
        this.startDate = startDate;
        this.endDate = endDate;
        this.budgetCap = budgetCap;
        this.joinCode = joinCode;
    }

    public Long getId() { return id; }
    public String getDestination() { return destination; }
    public void setDestination(String destination) { this.destination = destination; }
    public LocalDate getStartDate() { return startDate; }
    public void setStartDate(LocalDate startDate) { this.startDate = startDate; }
    public LocalDate getEndDate() { return endDate; }
    public void setEndDate(LocalDate endDate) { this.endDate = endDate; }
    public BigDecimal getBudgetCap() { return budgetCap; }
    public void setBudgetCap(BigDecimal budgetCap) { this.budgetCap = budgetCap; }
    public String getJoinCode() { return joinCode; }
    public void setJoinCode(String joinCode) { this.joinCode = joinCode; }
}