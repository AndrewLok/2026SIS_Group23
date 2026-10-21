package com.voyager.backend.expense;

import java.util.Locale;

public enum ExpenseCategory {
    FOOD, TRANSPORT, TICKETS, STAY, OTHER;

    /** The lowercase name the front end uses, e.g. "food". */
    public String wireName() {
        return name().toLowerCase(Locale.ROOT);
    }

    /** Parses the front end's lowercase name. Returns null when it isn't a known category. */
    public static ExpenseCategory fromWire(String value) {
        if (value == null) return null;
        try {
            return valueOf(value.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            return null;
        }
    }
}
