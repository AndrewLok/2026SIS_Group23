package com.voyager.backend.common;

// How long the text people type is allowed to be. The same numbers are the database column sizes
// (see the @Column(length = ...) on User and Trip) and are repeated in the frontend's forms, so a
// person is stopped on the screen and the server still refuses anything that gets past it with a
// 400 and a message, instead of letting the database fail with something that looks like a clash.

public final class Limits {

    private Limits() {}

    public static final int DISPLAY_NAME = 60;
    public static final int EMAIL = 254;        // The longest an email address can be.
    public static final int TRIP_NAME = 100;
    public static final int DESTINATION = 100;
    public static final int IDEA_TITLE = 100;
    public static final int IDEA_DESCRIPTION = 2000;
    public static final int BOOKING_TITLE = 100;
    public static final int BOOKING_PROVIDER = 100;
    public static final int BOOKING_REFERENCE = 50;
    public static final int BOOKING_PLACE = 200;     // Where from or to, or a stay's address.
    public static final int BOOKING_NOTES = 2000;
    public static final long MAX_BOOKING_COST_CENTS = 10_000_000_000L; // 100 million dollars: a typo, not a trip.
    public static final int EXPENSE_DESCRIPTION = 100;
    public static final long MAX_EXPENSE_CENTS = 10_000_000_000L;      // The same ceiling as a booking.
    public static final int FUEL_LABEL = 90;          // Its expense is "Fuel: " and the label, which has to fit EXPENSE_DESCRIPTION.
    public static final double MAX_FUEL_KM = 100_000; // Two and a half times round the world.
    public static final double MAX_FUEL_EFFICIENCY = 100;  // Litres per 100 km; also what a trip's default may be.
    public static final int MAX_FUEL_PRICE_CENTS = 100_000; // A thousand dollars a litre: a typo. Also a trip default's ceiling.

    // "That name is too long. Keep it to 60 characters or fewer."
    public static String tooLong(String what, int max) {
        return "That " + what + " is too long. Keep it to " + max + " characters or fewer.";
    }
}
