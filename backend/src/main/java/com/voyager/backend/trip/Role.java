package com.voyager.backend.trip;

import java.util.Locale;

// A member's role on one trip. Stored by name in the database; on the wire it is the lower-case
// word the frontend uses ('owner' or 'member').

public enum Role {
    OWNER,
    MEMBER;

    public String wire() {
        return name().toLowerCase(Locale.ROOT);
    }

    // Null for anything that is not a role, so the caller can answer with a 400.
    public static Role fromWire(String value) {
        if (value == null) {
            return null;
        }
        return switch (value.trim().toLowerCase(Locale.ROOT)) {
            case "owner" -> OWNER;
            case "member" -> MEMBER;
            default -> null;
        };
    }
}
