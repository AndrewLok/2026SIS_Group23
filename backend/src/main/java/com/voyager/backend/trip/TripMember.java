package com.voyager.backend.trip;

import java.time.Instant;

import com.voyager.backend.common.Ids;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

/** One person on one trip. Leaving deletes the row; what they paid and owe stays on the expenses. */
@Entity
@Table(name = "trip_members",
        uniqueConstraints = @UniqueConstraint(columnNames = {"trip_id", "user_id"}),
        indexes = @Index(name = "idx_trip_members_user_id", columnList = "user_id"))
public class TripMember {

    public static final String OWNER = "owner";
    public static final String MEMBER = "member";

    @Id
    private String id;

    @Column(name = "trip_id", nullable = false)
    private String tripId;

    @Column(name = "user_id", nullable = false)
    private String userId;

    @Column(nullable = false)
    private String role; // "owner" or "member", as the front end spells them.

    @Column(nullable = false)
    private Instant joinedAt;

    public TripMember() {}

    public TripMember(String tripId, String userId, String role, Instant joinedAt) {
        this.id = Ids.newId();
        this.tripId = tripId;
        this.userId = userId;
        this.role = role;
        this.joinedAt = joinedAt;
    }

    public String getId() { return id; }
    public String getTripId() { return tripId; }
    public String getUserId() { return userId; }
    public String getRole() { return role; }
    public void setRole(String role) { this.role = role; }
    public Instant getJoinedAt() { return joinedAt; }
    public boolean isOwner() { return OWNER.equals(role); }
}
