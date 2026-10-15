package com.vayager.backend.user.requestDTO;

public record LoginRequest(
    private String email;
    private String password;
) {}
