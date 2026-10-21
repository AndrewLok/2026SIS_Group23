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

    // "That name is too long. Keep it to 60 characters or fewer."
    public static String tooLong(String what, int max) {
        return "That " + what + " is too long. Keep it to " + max + " characters or fewer.";
    }
}
