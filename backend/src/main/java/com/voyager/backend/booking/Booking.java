package com.voyager.backend.booking;

import java.time.Instant;

import com.voyager.backend.common.Ids;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;

/** Something booked for the trip: a flight, a stay, a car, or anything else with a reference. */
@Entity
@Table(name = "bookings", indexes = @Index(name = "idx_bookings_trip_id", columnList = "trip_id"))
public class Booking {

    @Id
    private String id;

    @Column(name = "trip_id", nullable = false)
    private String tripId;

    @Column(nullable = false)
    private String type; // flight, stay, car or other.

    @Column(nullable = false)
    private String title;

    @Column(nullable = false)
    private String provider;

    @Column(nullable = false)
    private String reference;

    private Instant startsAt;
    private Instant endsAt;

    @Column(nullable = false)
    private String origin;

    @Column(nullable = false)
    private String destination;

    private Long costCents; // Null when nobody has priced it yet.

    private String belongsTo; // The member whose booking it is; null for a group booking.

    @Column(nullable = false, length = 2000)
    private String notes;

    public Booking() {}

    public Booking(String id, String tripId, String type, String title, String provider, String reference,
                   Instant startsAt, Instant endsAt, String origin, String destination, Long costCents,
                   String belongsTo, String notes) {
        this.id = id == null ? Ids.newId() : id;
        this.tripId = tripId;
        this.type = type;
        this.title = title;
        this.provider = provider;
        this.reference = reference;
        this.startsAt = startsAt;
        this.endsAt = endsAt;
        this.origin = origin;
        this.destination = destination;
        this.costCents = costCents;
        this.belongsTo = belongsTo;
        this.notes = notes;
    }

    public String getId() { return id; }
    public String getTripId() { return tripId; }
    public String getType() { return type; }
    public void setType(String type) { this.type = type; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getProvider() { return provider; }
    public void setProvider(String provider) { this.provider = provider; }
    public String getReference() { return reference; }
    public void setReference(String reference) { this.reference = reference; }
    public Instant getStartsAt() { return startsAt; }
    public void setStartsAt(Instant startsAt) { this.startsAt = startsAt; }
    public Instant getEndsAt() { return endsAt; }
    public void setEndsAt(Instant endsAt) { this.endsAt = endsAt; }
    public String getOrigin() { return origin; }
    public void setOrigin(String origin) { this.origin = origin; }
    public String getDestination() { return destination; }
    public void setDestination(String destination) { this.destination = destination; }
    public Long getCostCents() { return costCents; }
    public void setCostCents(Long costCents) { this.costCents = costCents; }
    public String getBelongsTo() { return belongsTo; }
    public void setBelongsTo(String belongsTo) { this.belongsTo = belongsTo; }
    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }
}
