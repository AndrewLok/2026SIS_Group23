package com.voyager.backend.trip;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

// Instead of writing SQL, we use JPA (Jakarta Persistence API) to map objects to database tables.
// This mirrors the frontend's Trip type. Two rules carry over from it: money is whole cents, never
// a decimal, and dates are instants (UTC) that the frontend formats when it shows them.
// Who is on the trip lives in TripMember, not here.

@Entity // This tag tells JPA that the class represents a database table.
@Table(name = "trips")
public class Trip {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID) // IDENTITY is for numeric ids and fails on a UUID.
    private UUID id; // The unique ID of the trip.

    @Column(nullable = false, length = 100) // Limits.TRIP_NAME
    private String name; // What the group calls the trip.

    @Column(nullable = false, length = 100) // Limits.DESTINATION
    private String destination; // May be empty: the frontend lets a trip start with no destination.

    private Instant startDate; // Trip start (optional)
    private Instant endDate; // Trip end (optional)

    @Column(nullable = false, unique = true, length = 6) // This, not a table-level constraint, is what keeps codes unique.
    private String inviteCode; // The code to be able to join the trip

    @Column(nullable = false)
    private UUID createdBy; // The user who made the trip.

    @Column(nullable = false, length = 3)
    private String currency = "AUD";

    @Column(nullable = false)
    private int coverHue; // 0-359, the trip's colour on the trip list.

    private Long budgetCapCents; // The budget cap of the trip, in cents. Optional.

    // Per-member manual allowance used by the trip cost estimate, in cents.
    @Column(nullable = false)
    private long allowanceCents = 25_000;

    // Remembered fuel defaults, so the add-leg form is never empty.
    @Column(nullable = false)
    private double defaultEfficiency = 8.0; // L/100km
    @Column(nullable = false)
    private int defaultPricePerLitreCents = 195;

    // Trip setting: hide settlement rows that do not involve the current user.
    @Column(nullable = false)
    private boolean privateDebts = true;

    public Trip() {}

    public Trip(String name, String destination, Instant startDate, Instant endDate,
                Long budgetCapCents, String inviteCode, UUID createdBy, int coverHue) {
        this.name = name;
        this.destination = destination;
        this.startDate = startDate;
        this.endDate = endDate;
        this.budgetCapCents = budgetCapCents;
        this.inviteCode = inviteCode;
        this.createdBy = createdBy;
        this.coverHue = coverHue;
    }

    public UUID getId() { return id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getDestination() { return destination; }
    public void setDestination(String destination) { this.destination = destination; }
    public Instant getStartDate() { return startDate; }
    public void setStartDate(Instant startDate) { this.startDate = startDate; }
    public Instant getEndDate() { return endDate; }
    public void setEndDate(Instant endDate) { this.endDate = endDate; }
    public String getInviteCode() { return inviteCode; }
    public void setInviteCode(String inviteCode) { this.inviteCode = inviteCode; }
    public UUID getCreatedBy() { return createdBy; }
    public String getCurrency() { return currency; }
    public void setCurrency(String currency) { this.currency = currency; }
    public int getCoverHue() { return coverHue; }
    public Long getBudgetCapCents() { return budgetCapCents; }
    public void setBudgetCapCents(Long budgetCapCents) { this.budgetCapCents = budgetCapCents; }
    public long getAllowanceCents() { return allowanceCents; }
    public void setAllowanceCents(long allowanceCents) { this.allowanceCents = allowanceCents; }
    public double getDefaultEfficiency() { return defaultEfficiency; }
    public void setDefaultEfficiency(double defaultEfficiency) { this.defaultEfficiency = defaultEfficiency; }
    public int getDefaultPricePerLitreCents() { return defaultPricePerLitreCents; }
    public void setDefaultPricePerLitreCents(int defaultPricePerLitreCents) { this.defaultPricePerLitreCents = defaultPricePerLitreCents; }
    public boolean isPrivateDebts() { return privateDebts; }
    public void setPrivateDebts(boolean privateDebts) { this.privateDebts = privateDebts; }
}
