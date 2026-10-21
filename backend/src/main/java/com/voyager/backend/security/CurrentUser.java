package com.voyager.backend.security;

import java.util.UUID;

import org.springframework.security.core.Authentication;

// The login session stores the user's id as the principal (see UserController.signIn).
// Controllers take an Authentication parameter and ask this who it is.

public final class CurrentUser {

    private CurrentUser() {}

    public static UUID id(Authentication authentication) {
        return UUID.fromString(authentication.getName());
    }
}
