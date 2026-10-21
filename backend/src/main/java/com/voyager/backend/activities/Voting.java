package com.voyager.backend.activities;

// The rule for carrying a vote lives here alone, the same way it lives alone in the frontend's
// lib/voting.ts. Keep the two in step.

public final class Voting {

    private Voting() {}

    // Votes needed to carry an activity: more than half of the people on the trip.
    // Four people need three, five need three, six need four.
    public static long threshold(long memberCount) {
        return memberCount / 2 + 1;
    }

    public static boolean reached(long agreeCount, long memberCount) {
        return memberCount > 0 && agreeCount >= threshold(memberCount);
    }

    // The status an activity should hold given its votes. Only ever moves between VOTING and AGREED:
    // a rejection is decided by a person and a planned activity was never voted on, so neither
    // changes with the count.
    public static IdeaStatus statusFor(IdeaStatus current, long agreeCount, long memberCount) {
        if (current == IdeaStatus.REJECTED || current == IdeaStatus.PLANNED) {
            return current;
        }
        return reached(agreeCount, memberCount) ? IdeaStatus.AGREED : IdeaStatus.VOTING;
    }
}
