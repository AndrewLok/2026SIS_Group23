package com.voyager.backend.trip;

import java.util.UUID;
import java.math.BigDecimal;
import java.time.LocalDate;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.UniqueConstraint;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

// Instead of writing SQL, we use JPA (Jakarta Persistence API) to map objects to database tables.

@Entity // This tag tells JPA that the class represents a database table.
@Table(name = "trips",
        uniqueConstraints = @UniqueConstraint(columnNames = {"id"}))
public class Trip {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private UUID id; // The unique ID of the trip.

    @Column(nullable = false)
    private String destination; // The destination of the trip (Expand to be able to include multiple destinations?)

    private LocalDate startDate; // Trip start date
    private LocalDate endDate; // Trip end date (Maybe make per-user start and end dates?)

    @Column(precision = 10, scale = 2)
    private BigDecimal budgetCap; // The budget cap of the trip (Maybe make per-user budget cap?)

    @Column(unique = true)
    private String joinCode; // The code to be able to join the trip (Investigate if it would be better for the trip 'planner' to invite people instead)

    public Trip() {}

    public Trip(String destination, LocalDate startDate, LocalDate endDate, BigDecimal budgetCap, String joinCode) {
        this.destination = destination;
        this.startDate = startDate;
        this.endDate = endDate;
        this.budgetCap = budgetCap;
        this.joinCode = joinCode;
    }

    public UUID getId() { return id; }
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
