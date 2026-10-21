package com.voyager.backend.trip;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

// One row per person on one trip. This is what "being on a trip" means: every even split, vote
// threshold and trip list is worked out from these rows.

@Entity
@Table(name = "trip_members",
        // A person can be on a trip only once. The column names are given explicitly below so that
        // this constraint refers to exactly the columns that exist, whatever the naming strategy.
        uniqueConstraints = @UniqueConstraint(columnNames = {"trip_id", "user_id"}))
public class TripMember {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "trip_id", nullable = false)
    private UUID tripId;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Role role;

    @Column(nullable = false)
    private Instant joinedAt;

    public TripMember() {}

    public TripMember(UUID tripId, UUID userId, Role role, Instant joinedAt) {
        this.tripId = tripId;
        this.userId = userId;
        this.role = role;
        this.joinedAt = joinedAt;
    }

    public UUID getId() { return id; }
    public UUID getTripId() { return tripId; }
    public UUID getUserId() { return userId; }
    public Role getRole() { return role; }
    public void setRole(Role role) { this.role = role; }
    public Instant getJoinedAt() { return joinedAt; }
}
