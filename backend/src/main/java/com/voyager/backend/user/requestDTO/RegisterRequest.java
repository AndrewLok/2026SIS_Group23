package com.voyager.backend.user.requestDTO;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record RegisterRequest(
        @NotNull
        @Size(max = 100)
        String firstName,

        @NotNull
        @Size(max = 100)
        String lastName,

        @NotNull
        @Email
        @Size(max = 254)
        String email,

        @NotNull
        @Size(min = 8, max = 72)
        String password
) {}