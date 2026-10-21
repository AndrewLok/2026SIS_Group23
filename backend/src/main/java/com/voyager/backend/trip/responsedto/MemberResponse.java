package com.voyager.backend.trip.responsedto;

import java.time.Instant;
import java.util.UUID;

import com.voyager.backend.trip.TripService.MemberDetail;

// The frontend's TripMember plus the person's profile. role is "owner" or "member".

public record MemberResponse(
    UUID tripId,
    UUID userId,
    String role,
    Instant joinedAt,
    MemberProfile profile
) {
    public static MemberResponse from(MemberDetail detail) {
        return new MemberResponse(
            detail.member().getTripId(),
            detail.member().getUserId(),
            detail.member().getRole().wire(),
            detail.member().getJoinedAt(),
            MemberProfile.from(detail.user())
        );
    }
}
