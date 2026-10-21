package com.voyager.backend.activities;

import java.util.Locale;

// What kind of thing an activity is. Stored by name; on the wire it is the lower-case word the
// frontend uses.

public enum IdeaCategory {
    ACTIVITY,
    FOOD,
    STAY,
    TRAVEL;

    public String wire() {
        return name().toLowerCase(Locale.ROOT);
    }

    // Null for anything that is not a category, so the caller can answer with a 400.
    public static IdeaCategory fromWire(String value) {
        if (value == null) {
            return null;
        }
        return switch (value.trim().toLowerCase(Locale.ROOT)) {
            case "activity" -> ACTIVITY;
            case "food" -> FOOD;
            case "stay" -> STAY;
            case "travel" -> TRAVEL;
            default -> null;
        };
    }
}
