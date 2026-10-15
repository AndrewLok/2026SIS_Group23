package com.voyager.backend.user.requestDTO;

public record LoginRequest(
    private String email,
    private String password
) {}
