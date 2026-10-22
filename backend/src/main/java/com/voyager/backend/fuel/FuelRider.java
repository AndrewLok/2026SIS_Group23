package com.voyager.backend.fuel;

import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

// One person who rode on a leg, and so shares its cost. A plain user id: someone named here who
// later leaves the trip still owes their part (the same rule as an expense's split).

@Entity
@Table(name = "fuel_riders",
        uniqueConstraints = @UniqueConstraint(columnNames = {"leg_id", "user_id"}))
public class FuelRider {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "leg_id", nullable = false)
    private UUID legId;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    public FuelRider() {}

    public FuelRider(UUID legId, UUID userId) {
        this.legId = legId;
        this.userId = userId;
    }

    public UUID getId() { return id; }
    public UUID getLegId() { return legId; }
    public UUID getUserId() { return userId; }
}
