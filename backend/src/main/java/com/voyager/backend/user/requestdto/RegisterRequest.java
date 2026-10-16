package com.voyager.backend.user.requestdto;

public record RegisterRequest(
    String firstName,
    String lastName,
    String email,
    String password
) {}
