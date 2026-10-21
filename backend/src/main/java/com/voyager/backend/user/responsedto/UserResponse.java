package com.voyager.backend.user.responsedto;

import java.util.UUID;

import com.voyager.backend.user.User;

// Response DTO's describe data going out to the frontend. This is the frontend's
// Profile type exactly (id, displayName, email, avatarHue), and it never carries the password hash.

public record UserResponse(
    UUID id,
    String displayName,
    String email,
    int avatarHue
) {
    public static UserResponse from(User user) {
        return new UserResponse(user.getId(), user.getDisplayName(), user.getEmail(), user.getAvatarHue());
    }
}
