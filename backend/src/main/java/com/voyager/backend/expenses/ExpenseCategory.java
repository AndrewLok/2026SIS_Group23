package com.voyager.backend.expenses;

import java.util.Locale;

// What the money went on. Only the screen's badges care; the server keeps it.

public enum ExpenseCategory {
    FOOD,
    TRANSPORT,
    TICKETS,
    STAY,
    OTHER;

    public String wire() {
        return name().toLowerCase(Locale.ROOT);
    }

    // Null for anything that is not a category, so the caller can answer with a 400.
    public static ExpenseCategory fromWire(String value) {
        if (value == null) {
            return null;
        }
        return switch (value.trim().toLowerCase(Locale.ROOT)) {
            case "food" -> FOOD;
            case "transport" -> TRANSPORT;
            case "tickets" -> TICKETS;
            case "stay" -> STAY;
            case "other" -> OTHER;
            default -> null;
        };
    }
}
