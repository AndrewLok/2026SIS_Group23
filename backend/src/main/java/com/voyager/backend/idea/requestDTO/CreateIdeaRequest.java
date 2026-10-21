package com.voyager.backend.idea.requestDTO;

import java.util.List;

/** The front end's NewIdea. needsVote false adds it straight to the plan; true puts it to the group. */
public record CreateIdeaRequest(
        String title,
        String description,
        String category,
        String proposedStart,
        String proposedEnd,
        Boolean allDay,
        Boolean needsVote,
        List<String> attendeeIds
) {}
