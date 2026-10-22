package com.voyager.backend.bookings.responsedto;

import java.time.Instant;
import java.util.UUID;

import com.voyager.backend.bookings.Booking;

// The frontend's Booking type, field for field, plus who added it (so the screen knows whether to
// offer Delete). type is the lower-case word.

public record BookingResponse(
    UUID id,
    UUID tripId,
    String type,
    String title,
    String provider,
    String reference,
    Instant startsAt,
    Instant endsAt,
    String origin,
    String destination,
    Long costCents,
    UUID belongsTo,
    String notes,
    UUID createdBy,
    Instant createdAt
) {
    public static BookingResponse from(Booking b) {
        return new BookingResponse(
            b.getId(),
            b.getTripId(),
            b.getType().wire(),
            b.getTitle(),
            b.getProvider(),
            b.getReference(),
            b.getStartsAt(),
            b.getEndsAt(),
            b.getOrigin(),
            b.getDestination(),
            b.getCostCents(),
            b.getBelongsTo(),
            b.getNotes(),
            b.getCreatedBy(),
            b.getCreatedAt()
        );
    }
}
