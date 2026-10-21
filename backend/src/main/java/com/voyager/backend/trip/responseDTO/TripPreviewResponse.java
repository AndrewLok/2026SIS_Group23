package com.voyager.backend.trip.responseDTO;

import java.util.List;

import com.voyager.backend.user.responseDTO.ProfileResponse;

/** What the join screen shows before you commit: the trip and who is already on it. */
public record TripPreviewResponse(
        TripResponse trip,
        List<ProfileResponse> members
) {}
