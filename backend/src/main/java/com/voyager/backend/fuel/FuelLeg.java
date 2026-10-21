package com.voyager.backend.fuel;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

import com.voyager.backend.common.Ids;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OrderColumn;
import jakarta.persistence.Table;

/**
 * One stretch of driving. The only thing in the app that splits across a subset of the group,
 * so it carries its own rider list, and it writes through to an expense marked source "fuel".
 */
@Entity
@Table(name = "fuel_legs", indexes = @Index(name = "idx_fuel_legs_trip_id", columnList = "trip_id"))
public class FuelLeg {

    @Id
    private String id;

    @Column(name = "trip_id", nullable = false)
    private String tripId;

    @Column(nullable = false)
    private String label; // e.g. "Lorne to Apollo Bay".

    private double distanceKm;
    private double efficiencyL100km;
    private long pricePerLitreCents;

    @Column(nullable = false)
    private String driverId; // Pays for the fuel, so is the expense's payer.

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "fuel_leg_riders", joinColumns = @JoinColumn(name = "fuel_leg_id"))
    @OrderColumn(name = "position")
    @Column(name = "user_id", nullable = false)
    private List<String> riderIds = new ArrayList<>(); // Who chips in, the driver included if named.

    @Column(nullable = false)
    private Instant createdAt;

    public FuelLeg() {}

    public FuelLeg(String id, String tripId, String label, double distanceKm, double efficiencyL100km,
                   long pricePerLitreCents, String driverId, List<String> riderIds, Instant createdAt) {
        this.id = id == null ? Ids.newId() : id;
        this.tripId = tripId;
        this.label = label;
        this.distanceKm = distanceKm;
        this.efficiencyL100km = efficiencyL100km;
        this.pricePerLitreCents = pricePerLitreCents;
        this.driverId = driverId;
        this.riderIds = new ArrayList<>(riderIds);
        this.createdAt = createdAt;
    }

    /**
     * litres = distance * efficiency / 100, cost = litres * price, rounded to whole cents once
     * at the end. The same sum as lib/fuel.ts, in the same order, so both sides agree.
     */
    public long costCents() {
        double litres = (distanceKm * efficiencyL100km) / 100;
        return Math.round(litres * pricePerLitreCents);
    }

    public String getId() { return id; }
    public String getTripId() { return tripId; }
    public String getLabel() { return label; }
    public void setLabel(String label) { this.label = label; }
    public double getDistanceKm() { return distanceKm; }
    public void setDistanceKm(double distanceKm) { this.distanceKm = distanceKm; }
    public double getEfficiencyL100km() { return efficiencyL100km; }
    public void setEfficiencyL100km(double efficiencyL100km) { this.efficiencyL100km = efficiencyL100km; }
    public long getPricePerLitreCents() { return pricePerLitreCents; }
    public void setPricePerLitreCents(long pricePerLitreCents) { this.pricePerLitreCents = pricePerLitreCents; }
    public String getDriverId() { return driverId; }
    public void setDriverId(String driverId) { this.driverId = driverId; }
    public List<String> getRiderIds() { return riderIds; }
    public Instant getCreatedAt() { return createdAt; }

    public void setRiderIds(List<String> ids) {
        riderIds.clear();
        riderIds.addAll(ids);
    }
}
