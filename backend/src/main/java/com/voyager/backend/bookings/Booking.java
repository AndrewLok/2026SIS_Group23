package com.voyager.backend.bookings;

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

// Something already booked elsewhere: a flight, a stay, a car. Unlike an activity there is nothing
// to decide, so there are no votes; it is a record of what someone typed in from their confirmation.
// The frontend's Booking, plus who added it. It belongs either to the whole group (belongsTo null)
// or to one person on the trip.

@Entity
@Table(name = "bookings", indexes = @Index(columnList = "trip_id"))
public class Booking {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "trip_id", nullable = false)
    private UUID tripId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private BookingType type;

    @Column(nullable = false, length = 100) // Limits.BOOKING_TITLE
    private String title;

    @Column(nullable = false, length = 100) // Limits.BOOKING_PROVIDER
    private String provider;

    @Column(nullable = false, length = 50) // Limits.BOOKING_REFERENCE
    private String reference;

    // Both optional. A booking with no start time is kept but cannot go on the calendar.
    private Instant startsAt;
    private Instant endsAt;

    @Column(nullable = false, length = 200) // Limits.BOOKING_PLACE
    private String origin;

    @Column(nullable = false, length = 200) // Limits.BOOKING_PLACE
    private String destination;

    // Whole cents. Null means "no cost entered", which is not the same as free.
    private Long costCents;

    // The person it is for, or null for the whole group. Kept as a plain id; the service makes sure
    // it is someone on the trip, and removes the booking if that person leaves.
    @Column(name = "belongs_to")
    private UUID belongsTo;

    @Column(nullable = false, length = 2000) // Limits.BOOKING_NOTES
    private String notes;

    // A plain id: if the person who typed it in leaves the trip, the booking stays.
    @Column(name = "created_by", nullable = false)
    private UUID createdBy;

    @Column(nullable = false)
    private Instant createdAt;

    public Booking() {}

    public Booking(UUID tripId, BookingType type, String title, String provider, String reference,
            Instant startsAt, Instant endsAt, String origin, String destination, Long costCents,
            UUID belongsTo, String notes, UUID createdBy, Instant createdAt) {
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
        this.createdBy = createdBy;
        this.createdAt = createdAt;
    }

    public UUID getId() { return id; }
    public UUID getTripId() { return tripId; }
    public BookingType getType() { return type; }
    public void setType(BookingType type) { this.type = type; }
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
    public UUID getBelongsTo() { return belongsTo; }
    public void setBelongsTo(UUID belongsTo) { this.belongsTo = belongsTo; }
    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }
    public UUID getCreatedBy() { return createdBy; }
    public Instant getCreatedAt() { return createdAt; }
}
