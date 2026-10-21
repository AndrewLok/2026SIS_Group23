package com.voyager.backend.trip.responsedto;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import com.voyager.backend.trip.Trip;
import com.voyager.backend.trip.TripService.MemberPreview;

// What someone holding an invite code may see before they join: enough to recognise the trip
// and who is on it, and nothing about its money or settings.

public record TripPreviewResponse(
    PreviewTrip trip,
    List<MemberProfile> members
) {
    public record PreviewTrip(
        UUID id,
        String name,
        String destination,
        Instant startDate,
        Instant endDate
    ) {
        static PreviewTrip from(Trip trip) {
            return new PreviewTrip(trip.getId(), trip.getName(), trip.getDestination(), trip.getStartDate(), trip.getEndDate());
        }
    }

    public static TripPreviewResponse from(MemberPreview preview) {
        return new TripPreviewResponse(
            PreviewTrip.from(preview.trip()),
            preview.members().stream().map(detail -> MemberProfile.from(detail.user())).toList()
        );
    }
}
