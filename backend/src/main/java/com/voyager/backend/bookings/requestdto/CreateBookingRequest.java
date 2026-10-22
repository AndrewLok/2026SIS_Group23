package com.voyager.backend.bookings.requestdto;

// What the frontend's "Add booking" sends. The type is the lower-case word and the times are ISO
// instants as text; both are checked by hand so a bad one gets a message, not a vague 400.
// belongsTo is a person's id, or null for the whole group. The cost is whole cents, or null.

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
