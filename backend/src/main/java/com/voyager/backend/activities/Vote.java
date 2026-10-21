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

// One person's vote on one activity: for or against. A person has at most one, and voting again
// replaces it. On the wire it is 1 or -1, which is what the frontend uses.

@Entity
@Table(name = "votes",
        uniqueConstraints = @UniqueConstraint(columnNames = {"idea_id", "user_id"}))
public class Vote {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "idea_id", nullable = false)
    private UUID ideaId;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    // true is for, false is against. (Not called "value": that is a reserved word in H2.)
    @Column(nullable = false)
    private boolean agree;

    @Column(nullable = false)
    private Instant createdAt;

    public Vote() {}

    public Vote(UUID ideaId, UUID userId, boolean agree, Instant createdAt) {
        this.ideaId = ideaId;
        this.userId = userId;
        this.agree = agree;
        this.createdAt = createdAt;
    }

    public UUID getId() { return id; }
    public UUID getIdeaId() { return ideaId; }
    public UUID getUserId() { return userId; }
    public boolean isAgree() { return agree; }
    public void setAgree(boolean agree) { this.agree = agree; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
