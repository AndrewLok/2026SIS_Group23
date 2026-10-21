package com.voyager.backend.booking.responseDTO;

import com.voyager.backend.booking.Booking;
import com.voyager.backend.common.Times;

/** Matches the front end's Booking type. */
public record BookingResponse(
        String id,
        String tripId,
        String type,
        String title,
        String provider,
        String reference,
        String startsAt,
        String endsAt,
        String origin,
        String destination,
        Long costCents,
        String belongsTo,
        String notes
) {
    public static BookingResponse from(Booking booking) {
        return new BookingResponse(
                booking.getId(),
                booking.getTripId(),
                booking.getType(),
                booking.getTitle(),
                booking.getProvider(),
                booking.getReference(),
                Times.iso(booking.getStartsAt()),
                Times.iso(booking.getEndsAt()),
                booking.getOrigin(),
                booking.getDestination(),
                booking.getCostCents(),
                booking.getBelongsTo(),
                booking.getNotes());
    }
}
