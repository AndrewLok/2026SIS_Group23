package com.voyager.backend.user.responseDTO;

import com.voyager.backend.user.User;

/** Matches the front end's Profile type. The password hash never leaves the server. */
public record ProfileResponse(
        String id,
        String displayName,
        String email,
        int avatarHue
) {
    public static ProfileResponse from(User user) {
        return new ProfileResponse(user.getId(), user.getDisplayName(), user.getEmail(), user.getAvatarHue());
    }
}
