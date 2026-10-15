package com.voyager.backend.user.requestDTO;

public record RegisterRequest(
    private String firstName,
    private String lastName,
    private String email,
    private String password
) {}
