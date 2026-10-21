package com.voyager.backend.activities.requestdto;

import java.util.List;

// What the frontend's "Add activity" sends. The times are ISO instants as text, and the category is
// the lower-case word; both are checked by hand so a bad one gets a message, not a vague 400.
// needsVote false adds it straight to the plan (it then needs a start time and attendeeIds);
// true puts it to the group, with the person adding it counted as agreeing.

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
