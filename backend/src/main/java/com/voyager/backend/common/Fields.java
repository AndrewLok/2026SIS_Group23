package com.voyager.backend.common;

import java.time.Instant;
import java.time.format.DateTimeParseException;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

// Reading the loosely typed values of a JSON body that arrives as a plain map. Used where "not
// sent" and "sent as null" have to mean different things, and where a number must be a whole number
// instead of being quietly cut short (Jackson turns 12.5 into 12 if it is asked for a long).
// Every failure is a 400 with a message that can be shown as it is.

public final class Fields {

    private Fields() {}

    public static String text(Object value, String field) {
        if (value instanceof String string) {
            return string;
        }
        throw ApiException.invalid(field + " has to be text.");
    }

    // A whole number of any size a long holds. 12.0 is accepted (it is exactly 12), 12.5 is not.
    public static long wholeNumber(Object value, String field) {
        if (value instanceof Integer || value instanceof Long || value instanceof Short || value instanceof Byte) {
            return ((Number) value).longValue();
        }
        if (value instanceof Double || value instanceof Float) {
            double d = ((Number) value).doubleValue();
            if (!Double.isNaN(d) && !Double.isInfinite(d) && d == Math.rint(d) && Math.abs(d) < 9e15) {
                return (long) d;
            }
        }
        throw ApiException.invalid(field + " has to be a whole number.");
    }

    // Any finite number, whole or not. Text is not a number, whatever it looks like.
    public static double decimal(Object value, String field) {
        if (value instanceof Number number && !(value instanceof java.math.BigInteger) && !(value instanceof java.math.BigDecimal)) {
            double d = number.doubleValue();
            if (!Double.isNaN(d) && !Double.isInfinite(d)) {
                return d;
            }
        }
        throw ApiException.invalid(field + " has to be a number.");
    }

    public static Instant instant(Object value, String field) {
        if (value instanceof String string) {
            try {
                return Instant.parse(string.trim()).truncatedTo(ChronoUnit.MICROS);
            } catch (DateTimeParseException e) {
                // Falls through to the message below.
            }
        }
        throw ApiException.invalid(field + " has to be a date and time like 2026-11-08T00:00:00Z.");
    }

    // Null when it is not an id at all, so the caller can say what that person was for.
    public static UUID uuidOrNull(Object value) {
        if (value instanceof String string) {
            try {
                return UUID.fromString(string.trim());
            } catch (IllegalArgumentException e) {
                return null;
            }
        }
        return null;
    }
}
