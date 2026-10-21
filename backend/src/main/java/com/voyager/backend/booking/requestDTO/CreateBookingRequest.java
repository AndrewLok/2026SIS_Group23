package com.voyager.backend.booking.requestDTO;

/** The front end's NewBooking. */
public record CreateBookingRequest(
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
) {}
