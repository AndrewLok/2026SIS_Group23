package com.voyager.backend.expenses;

import java.util.Locale;

// Where an expense came from. MANUAL is one somebody typed in. FUEL is written by a fuel leg and
// follows that leg (sourceId is the leg's id), so it cannot be changed or deleted here. Nothing
// creates FUEL ones yet: fuel still lives on the frontend's mock layer.

public enum ExpenseSource {
    MANUAL,
    FUEL;

    public String wire() {
        return name().toLowerCase(Locale.ROOT);
    }
}
