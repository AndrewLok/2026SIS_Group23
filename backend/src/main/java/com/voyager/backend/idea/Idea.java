package com.voyager.backend.idea;

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
 * An activity: something the group might do, or has decided to do.
 *
 * planned: added straight to the plan, no vote.
 * voting, agreed, rejected: put to the group and decided by votes.
 */
@Entity
@Table(name = "ideas", indexes = @Index(name = "idx_ideas_trip_id", columnList = "trip_id"))
public class Idea {

    public static final String PLANNED = "planned";
    public static final String VOTING = "voting";
    public static final String AGREED = "agreed";
    public static final String REJECTED = "rejected";

    @Id
    private String id;

    @Column(name = "trip_id", nullable = false)
    private String tripId;

    @Column(nullable = false)
    private String title;

    @Column(nullable = false, length = 2000)
    private String description;

    @Column(nullable = false)
    private String category; // activity, food, stay or travel.

    private Instant proposedStart;
    private Instant proposedEnd;
    private boolean allDay;

    @Column(nullable = false)
    private String status;

    @Column(nullable = false)
    private String proposedBy;

    // Who is going. Kept in the order people said yes, which is how the front end shows them.
    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "idea_attendees", joinColumns = @JoinColumn(name = "idea_id"))
    @OrderColumn(name = "position")
    @Column(name = "user_id", nullable = false)
    private List<String> attendeeIds = new ArrayList<>();

    @Column(nullable = false)
    private Instant createdAt;

    public Idea() {}

    public Idea(String id, String tripId, String title, String description, String category, Instant proposedStart,
                Instant proposedEnd, boolean allDay, String status, String proposedBy, List<String> attendeeIds,
                Instant createdAt) {
        this.id = id == null ? Ids.newId() : id;
        this.tripId = tripId;
        this.title = title;
        this.description = description;
        this.category = category;
        this.proposedStart = proposedStart;
        this.proposedEnd = proposedEnd;
        this.allDay = allDay;
        this.status = status;
        this.proposedBy = proposedBy;
        this.attendeeIds = new ArrayList<>(attendeeIds);
        this.createdAt = createdAt;
    }

    public String getId() { return id; }
    public String getTripId() { return tripId; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }
    public Instant getProposedStart() { return proposedStart; }
    public void setProposedStart(Instant proposedStart) { this.proposedStart = proposedStart; }
    public Instant getProposedEnd() { return proposedEnd; }
    public void setProposedEnd(Instant proposedEnd) { this.proposedEnd = proposedEnd; }
    public boolean isAllDay() { return allDay; }
    public void setAllDay(boolean allDay) { this.allDay = allDay; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getProposedBy() { return proposedBy; }
    public List<String> getAttendeeIds() { return attendeeIds; }
    public Instant getCreatedAt() { return createdAt; }

    public void setAttendeeIds(List<String> ids) {
        attendeeIds.clear();
        for (String id : ids) if (!attendeeIds.contains(id)) attendeeIds.add(id);
    }

    /** Going ahead: either added straight to the plan or voted in. */
    public boolean isOnThePlan() {
        return PLANNED.equals(status) || AGREED.equals(status);
    }
}
