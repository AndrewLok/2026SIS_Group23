package com.voyager.backend.user.requestDTO;

public record RegisterRequest(
        String displayName,
        String email,
        String password
) {}
