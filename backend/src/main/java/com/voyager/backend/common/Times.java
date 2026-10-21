package com.voyager.backend.common;

import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;

/**
 * Timestamps go over the wire exactly as JavaScript's toISOString() writes them,
 * e.g. 2026-11-07T20:00:00.000Z. The front end sorts and compares these as strings, so a
 * second format with no milliseconds would sort wrongly against the first.
 */
public final class Times {

    private static final DateTimeFormatter ISO =
            DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'").withZone(ZoneOffset.UTC);

    private Times() {}

    public static String iso(Instant instant) {
        return instant == null ? null : ISO.format(instant);
    }

    /** Parses an ISO timestamp, or returns null for null. Throws invalid for anything else. */
    public static Instant parse(String value, String message) {
        if (value == null) return null;
        try {
            return Instant.parse(value.trim());
        } catch (DateTimeParseException e) {
            throw ApiException.invalid(message);
        }
    }
}
