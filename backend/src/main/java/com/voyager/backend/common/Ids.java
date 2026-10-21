package com.voyager.backend.common;

import java.util.UUID;

/**
 * Ids are strings everywhere. New rows get a random UUID; the demo seed uses readable fixed
 * ids like "usr-lachlan", because split remainders are allocated in id order and stable ids
 * keep the demo balances the same as the front end's mock.
 */
public final class Ids {

    private Ids() {}

    public static String newId() {
        return UUID.randomUUID().toString();
    }
}
