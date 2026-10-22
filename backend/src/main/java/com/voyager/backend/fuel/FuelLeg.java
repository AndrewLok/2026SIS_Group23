package com.voyager.backend.fuel;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;

// One drive, paid for by one person and shared by the people who rode. The frontend's FuelLeg, plus
// who added it. Its cost is never stored here: it is worked out from the three figures (FuelCost),
// and the same number is written as an expense (source FUEL) that is kept in step with the leg.
// The people who rode are FuelRider rows.

@Entity
@Table(name = "fuel_legs", indexes = @Index(columnList = "trip_id"))
public class FuelLeg {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "trip_id", nullable = false)
    private UUID tripId;

    @Column(nullable = false, length = 90) // Limits.FUEL_LABEL
    private String label;

    @Column(nullable = false)
    private double distanceKm;

    @Column(nullable = false)
    private double efficiencyL100km;

    @Column(nullable = false)
    private int pricePerLitreCents;

    // The person who pays at the pump and is paid back. A plain id: the service makes sure it is
    // someone on the trip when the leg is made or changed, and if they leave the leg stays, because
    // they are still owed the money.
    @Column(name = "driver_id", nullable = false)
    private UUID driverId;

    // A plain id: if the person who added it leaves the trip, the leg stays.
    @Column(name = "created_by", nullable = false)
    private UUID createdBy;

    @Column(nullable = false)
    private Instant createdAt;

    public FuelLeg() {}

    public FuelLeg(UUID tripId, String label, double distanceKm, double efficiencyL100km, int pricePerLitreCents,
            UUID driverId, UUID createdBy, Instant createdAt) {
        this.tripId = tripId;
        this.label = label;
        this.distanceKm = distanceKm;
        this.efficiencyL100km = efficiencyL100km;
        this.pricePerLitreCents = pricePerLitreCents;
        this.driverId = driverId;
        this.createdBy = createdBy;
        this.createdAt = createdAt;
    }

    public UUID getId() { return id; }
    public UUID getTripId() { return tripId; }
    public String getLabel() { return label; }
    public void setLabel(String label) { this.label = label; }
    public double getDistanceKm() { return distanceKm; }
    public void setDistanceKm(double distanceKm) { this.distanceKm = distanceKm; }
    public double getEfficiencyL100km() { return efficiencyL100km; }
    public void setEfficiencyL100km(double efficiencyL100km) { this.efficiencyL100km = efficiencyL100km; }
    public int getPricePerLitreCents() { return pricePerLitreCents; }
    public void setPricePerLitreCents(int pricePerLitreCents) { this.pricePerLitreCents = pricePerLitreCents; }
    public UUID getDriverId() { return driverId; }
    public void setDriverId(UUID driverId) { this.driverId = driverId; }
    public UUID getCreatedBy() { return createdBy; }
    public Instant getCreatedAt() { return createdAt; }
}
