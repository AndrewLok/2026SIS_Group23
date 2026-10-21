package com.voyager.backend.idea.responseDTO;

import com.voyager.backend.common.Times;
import com.voyager.backend.idea.Vote;

/** Matches the front end's Vote type. */
public record VoteResponse(
        String ideaId,
        String userId,
        int value,
        String createdAt
) {
    public static VoteResponse from(Vote vote) {
        return new VoteResponse(vote.getIdeaId(), vote.getUserId(), vote.getValue(), Times.iso(vote.getCreatedAt()));
    }
}
