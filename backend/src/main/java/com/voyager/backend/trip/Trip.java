package com.voyager.backend.trip;

import java.time.Instant;

import com.voyager.backend.common.Ids;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "trips")
public class Trip {

    @Id
    private String id;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private String destination; // Free text, e.g. "Victoria, Australia". May be empty.

    private Instant startDate;
    private Instant endDate;

    @Column(nullable = false, unique = true, length = 6)
    private String inviteCode; // Six uppercase characters, see TripService.newInviteCode.

    @Column(nullable = false)
    private String createdBy; // A user id.

    @Column(nullable = false, length = 3)
    private String currency;

    private int coverHue;

    private long allowanceCents; // Per-member manual allowance used by the trip cost estimate.

    private double defaultEfficiency; // L/100km, remembered from the last fuel leg.

    private long defaultPricePerLitreCents; // Remembered from the last fuel leg.

    private boolean privateDebts; // Hide settle-up rows that do not involve the viewer.

    public Trip() {}

    public Trip(String id, String name, String destination, Instant startDate, Instant endDate, String inviteCode,
                String createdBy, int coverHue) {
        this.id = id == null ? Ids.newId() : id;
        this.name = name;
        this.destination = destination;
        this.startDate = startDate;
        this.endDate = endDate;
        this.inviteCode = inviteCode;
        this.createdBy = createdBy;
        this.currency = "AUD";
        this.coverHue = coverHue;
        this.allowanceCents = 25_000;
        this.defaultEfficiency = 8.0;
        this.defaultPricePerLitreCents = 195;
        this.privateDebts = true;
    }

    public String getId() { return id; }
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
    public String getCreatedBy() { return createdBy; }
    public String getCurrency() { return currency; }
    public int getCoverHue() { return coverHue; }
    public long getAllowanceCents() { return allowanceCents; }
    public void setAllowanceCents(long allowanceCents) { this.allowanceCents = allowanceCents; }
    public double getDefaultEfficiency() { return defaultEfficiency; }
    public void setDefaultEfficiency(double defaultEfficiency) { this.defaultEfficiency = defaultEfficiency; }
    public long getDefaultPricePerLitreCents() { return defaultPricePerLitreCents; }
    public void setDefaultPricePerLitreCents(long cents) { this.defaultPricePerLitreCents = cents; }
    public boolean isPrivateDebts() { return privateDebts; }
    public void setPrivateDebts(boolean privateDebts) { this.privateDebts = privateDebts; }
}
