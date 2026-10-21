package com.voyager.backend.user.requestdto;

public record RegisterRequest(
    String displayName,
    String email,
    String password
) {}
