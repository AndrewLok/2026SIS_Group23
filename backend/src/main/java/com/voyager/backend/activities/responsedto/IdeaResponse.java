package com.voyager.backend.activities.responsedto;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import com.voyager.backend.activities.IdeaService.IdeaDetail;

// The frontend's Idea type, field for field. category and status are the lower-case words.

public record IdeaResponse(
    UUID id,
    UUID tripId,
    String title,
    String description,
    String category,
    Instant proposedStart,
    Instant proposedEnd,
    boolean allDay,
    String status,
    UUID proposedBy,
    List<UUID> attendeeIds,
    Instant createdAt
) {
    public static IdeaResponse from(IdeaDetail detail) {
        var idea = detail.idea();
        return new IdeaResponse(
            idea.getId(),
            idea.getTripId(),
            idea.getTitle(),
            idea.getDescription(),
            idea.getCategory().wire(),
            idea.getProposedStart(),
            idea.getProposedEnd(),
            idea.isAllDay(),
            idea.getStatus().wire(),
            idea.getProposedBy(),
            detail.attendeeIds(),
            idea.getCreatedAt()
        );
    }
}
