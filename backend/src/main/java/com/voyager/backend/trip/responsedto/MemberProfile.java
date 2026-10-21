package com.voyager.backend.trip.responsedto;

import java.util.UUID;

import com.voyager.backend.user.User;

// What other people on a trip get to see of someone: a name and a colour. No email address.
// (The frontend's Profile has an email; for other members it is left empty on the frontend side.)

public record MemberProfile(
    UUID id,
    String displayName,
    int avatarHue
) {
    public static MemberProfile from(User user) {
        return new MemberProfile(user.getId(), user.getDisplayName(), user.getAvatarHue());
    }
}
