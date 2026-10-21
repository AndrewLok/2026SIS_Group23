package com.voyager.backend.activities;

import java.util.Locale;

// Where an activity stands.
//   PLANNED  added straight to the plan, never put to a vote.
//   VOTING   put to the group and not yet carried.
//   AGREED   put to the group and carried (see Voting).
//   REJECTED put to the group and ruled out, which is somebody's decision, never a vote count.

public enum IdeaStatus {
    PLANNED,
    VOTING,
    AGREED,
    REJECTED;

    public String wire() {
        return name().toLowerCase(Locale.ROOT);
    }

    // Null for anything that is not a status, so the caller can answer with a 400.
    public static IdeaStatus fromWire(String value) {
        if (value == null) {
            return null;
        }
        return switch (value.trim().toLowerCase(Locale.ROOT)) {
            case "planned" -> PLANNED;
            case "voting" -> VOTING;
            case "agreed" -> AGREED;
            case "rejected" -> REJECTED;
            default -> null;
        };
    }

    // Going ahead: either added straight to the plan or voted in.
    public boolean onThePlan() {
        return this == PLANNED || this == AGREED;
    }
}
