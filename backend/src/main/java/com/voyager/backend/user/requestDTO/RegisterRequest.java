package com.voyager.backend.user.requestDTO;

public record RegisterRequest(
        String firstName,
        String lastName,
        String email,
        String password
) {}