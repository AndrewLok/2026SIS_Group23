package com.voyager.backend.activities;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;

// One thing the group might do, or is doing: the frontend's Idea. The votes on it are Vote rows and
// the people going are IdeaAttendee rows, so each can be added or removed on its own without
// two people rewriting the same list.

@Entity
@Table(name = "ideas", indexes = @Index(columnList = "trip_id"))
public class Idea {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "trip_id", nullable = false)
    private UUID tripId;

    @Column(nullable = false, length = 100) // Limits.IDEA_TITLE
    private String title;

    @Column(nullable = false, length = 2000) // Limits.IDEA_DESCRIPTION
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private IdeaCategory category;

    // Both optional. An activity going ahead with no start cannot be put on the calendar yet.
    private Instant proposedStart;
    private Instant proposedEnd;

    @Column(nullable = false)
    private boolean allDay;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private IdeaStatus status;

    // Kept as a plain id: if the person leaves the trip, what they proposed stays.
    @Column(name = "proposed_by", nullable = false)
    private UUID proposedBy;

    @Column(nullable = false)
    private Instant createdAt;

    public Idea() {}

    public Idea(UUID tripId, String title, String description, IdeaCategory category, Instant proposedStart,
            Instant proposedEnd, boolean allDay, IdeaStatus status, UUID proposedBy, Instant createdAt) {
        this.tripId = tripId;
        this.title = title;
        this.description = description;
        this.category = category;
        this.proposedStart = proposedStart;
        this.proposedEnd = proposedEnd;
        this.allDay = allDay;
        this.status = status;
        this.proposedBy = proposedBy;
        this.createdAt = createdAt;
    }

    public UUID getId() { return id; }
    public UUID getTripId() { return tripId; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public IdeaCategory getCategory() { return category; }
    public void setCategory(IdeaCategory category) { this.category = category; }
    public Instant getProposedStart() { return proposedStart; }
    public void setProposedStart(Instant proposedStart) { this.proposedStart = proposedStart; }
    public Instant getProposedEnd() { return proposedEnd; }
    public void setProposedEnd(Instant proposedEnd) { this.proposedEnd = proposedEnd; }
    public boolean isAllDay() { return allDay; }
    public void setAllDay(boolean allDay) { this.allDay = allDay; }
    public IdeaStatus getStatus() { return status; }
    public void setStatus(IdeaStatus status) { this.status = status; }
    public UUID getProposedBy() { return proposedBy; }
    public Instant getCreatedAt() { return createdAt; }
}
