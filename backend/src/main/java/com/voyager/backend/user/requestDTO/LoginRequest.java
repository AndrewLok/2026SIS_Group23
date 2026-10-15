package com.voyager.backend.user.requestDTO;

public record LoginRequest(
        String email,
        String password
) {}