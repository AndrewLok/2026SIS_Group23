package com.voyager.backend.idea;

import java.time.Instant;

import com.voyager.backend.common.Ids;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

/** One member's say on one idea. A second vote from the same member overwrites the first. */
@Entity
@Table(name = "votes", uniqueConstraints = @UniqueConstraint(columnNames = {"idea_id", "user_id"}))
public class Vote {

    @Id
    private String id;

    @Column(name = "idea_id", nullable = false)
    private String ideaId;

    @Column(name = "user_id", nullable = false)
    private String userId;

    @Column(name = "vote_value", nullable = false)
    private int value; // 1 agree, -1 disagree.

    @Column(nullable = false)
    private Instant createdAt;

    public Vote() {}

    public Vote(String ideaId, String userId, int value, Instant createdAt) {
        this.id = Ids.newId();
        this.ideaId = ideaId;
        this.userId = userId;
        this.value = value;
        this.createdAt = createdAt;
    }

    public String getId() { return id; }
    public String getIdeaId() { return ideaId; }
    public String getUserId() { return userId; }
    public int getValue() { return value; }
    public void setValue(int value) { this.value = value; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
