package com.voyager.backend.user.requestdto;

public record LoginRequest(
    String email,
    String password
) {}
