package com.voyager.backend.activities;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

// "This person is going to this." One row per person per activity.

@Entity
@Table(name = "idea_attendees",
        uniqueConstraints = @UniqueConstraint(columnNames = {"idea_id", "user_id"}))
public class IdeaAttendee {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "idea_id", nullable = false)
    private UUID ideaId;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(nullable = false)
    private Instant createdAt;

    public IdeaAttendee() {}

    public IdeaAttendee(UUID ideaId, UUID userId, Instant createdAt) {
        this.ideaId = ideaId;
        this.userId = userId;
        this.createdAt = createdAt;
    }

    public UUID getId() { return id; }
    public UUID getIdeaId() { return ideaId; }
    public UUID getUserId() { return userId; }
    public Instant getCreatedAt() { return createdAt; }
}
