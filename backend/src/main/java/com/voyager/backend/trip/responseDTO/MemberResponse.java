package com.voyager.backend.trip.responseDTO;

import com.voyager.backend.common.Times;
import com.voyager.backend.trip.TripMember;
import com.voyager.backend.user.responseDTO.ProfileResponse;

/** The front end's TripMember with the member's profile attached. */
public record MemberResponse(
        String tripId,
        String userId,
        String role,
        String joinedAt,
        ProfileResponse profile
) {
    public static MemberResponse from(TripMember member, ProfileResponse profile) {
        return new MemberResponse(member.getTripId(), member.getUserId(), member.getRole(),
                Times.iso(member.getJoinedAt()), profile);
    }
}
