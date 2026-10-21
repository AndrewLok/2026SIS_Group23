package com.voyager.backend.idea.responseDTO;

import java.util.List;

import com.voyager.backend.common.Times;
import com.voyager.backend.idea.Idea;

/** Matches the front end's Idea type. */
public record IdeaResponse(
        String id,
        String tripId,
        String title,
        String description,
        String category,
        String proposedStart,
        String proposedEnd,
        boolean allDay,
        String status,
        String proposedBy,
        List<String> attendeeIds,
        String createdAt
) {
    public static IdeaResponse from(Idea idea) {
        return new IdeaResponse(
                idea.getId(),
                idea.getTripId(),
                idea.getTitle(),
                idea.getDescription(),
                idea.getCategory(),
                Times.iso(idea.getProposedStart()),
                Times.iso(idea.getProposedEnd()),
                idea.isAllDay(),
                idea.getStatus(),
                idea.getProposedBy(),
                List.copyOf(idea.getAttendeeIds()),
                Times.iso(idea.getCreatedAt()));
    }
}
