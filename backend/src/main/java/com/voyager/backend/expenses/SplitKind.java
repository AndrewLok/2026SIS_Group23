package com.voyager.backend.expenses;

import java.util.Locale;

// How a manual expense is shared. An expense with no split at all is shared evenly by everyone on
// the trip.
//
//   EQUAL  evenly between the named people (the payer too, if named).
//   EXACT  a stated amount for each person who owes the payer; whatever is left of the total is the
//          payer's own share.

public enum SplitKind {
    EQUAL,
    EXACT;

    public String wire() {
        return name().toLowerCase(Locale.ROOT);
    }

    public static SplitKind fromWire(String value) {
        if (value == null) {
            return null;
        }
        return switch (value.trim().toLowerCase(Locale.ROOT)) {
            case "equal" -> EQUAL;
            case "exact" -> EXACT;
            default -> null;
        };
    }
}
