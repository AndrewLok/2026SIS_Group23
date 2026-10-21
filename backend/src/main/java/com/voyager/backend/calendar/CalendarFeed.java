package com.voyager.backend.calendar;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

// One person's subscription link for one trip's calendar. A calendar app fetches the link by itself
// and cannot send the login cookie, so the unguessable token in the link is what identifies the
// person. The token is read-only: it can show the calendar and nothing else.
//
// Kept as plain text rather than hashed so the link can be shown again whenever the person opens the
// share screen. It is 256 random bits, and it can be replaced at any time (CalendarService.regenerate),
// which stops the old link working. It also stops working the moment the person leaves the trip.

@Entity
@Table(name = "calendar_feeds",
        uniqueConstraints = @UniqueConstraint(columnNames = {"trip_id", "user_id"}))
public class CalendarFeed {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "trip_id", nullable = false)
    private UUID tripId;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(nullable = false, unique = true, length = 64)
    private String token;

    @Column(nullable = false)
    private Instant createdAt;

    public CalendarFeed() {}

    public CalendarFeed(UUID tripId, UUID userId, String token, Instant createdAt) {
        this.tripId = tripId;
        this.userId = userId;
        this.token = token;
        this.createdAt = createdAt;
    }

    public UUID getId() { return id; }
    public UUID getTripId() { return tripId; }
    public UUID getUserId() { return userId; }
    public String getToken() { return token; }
    public void setToken(String token) { this.token = token; }
    public Instant getCreatedAt() { return createdAt; }
}
