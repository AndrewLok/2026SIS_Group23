package com.voyager.backend.bookings;

import java.util.Locale;

// What kind of booking it is. Only the screen cares (the form asks for different things for each),
// the server only keeps it.

public enum BookingType {
    FLIGHT,
    STAY,
    CAR,
    OTHER;

    public String wire() {
        return name().toLowerCase(Locale.ROOT);
    }

    // Null for anything that is not a type, so the caller can answer with a 400.
    public static BookingType fromWire(String value) {
        if (value == null) {
            return null;
        }
        return switch (value.trim().toLowerCase(Locale.ROOT)) {
            case "flight" -> FLIGHT;
            case "stay" -> STAY;
            case "car" -> CAR;
            case "other" -> OTHER;
            default -> null;
        };
    }
}
