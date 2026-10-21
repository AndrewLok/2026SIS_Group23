package com.voyager.backend.activities.responsedto;

import java.time.Instant;
import java.util.UUID;

import com.voyager.backend.activities.Vote;

// The frontend's Vote type: value is 1 (for) or -1 (against).

public record VoteResponse(UUID ideaId, UUID userId, int value, Instant createdAt) {
    public static VoteResponse from(Vote vote) {
        return new VoteResponse(vote.getIdeaId(), vote.getUserId(), vote.isAgree() ? 1 : -1, vote.getCreatedAt());
    }
}
