package com.voyager.backend.trip;

import java.util.LinkedHashSet;
import java.util.Set;

import org.springframework.stereotype.Component;

import com.voyager.backend.common.ApiException;

/**
 * The membership checks every trip-scoped endpoint makes. The front end's mock skips these
 * because it only ever has one browser; a real server can't.
 */
@Component
public class TripAccess {

    private final TripRepository tripRepository;
    private final TripMemberRepository memberRepository;

    public TripAccess(TripRepository tripRepository, TripMemberRepository memberRepository) {
        this.tripRepository = tripRepository;
        this.memberRepository = memberRepository;
    }

    public Trip requireTrip(String tripId) {
        return tripRepository.findById(tripId)
                .orElseThrow(() -> ApiException.notFound("That trip does not exist."));
    }

    /** The trip, when the caller is on it. A trip you are not on looks like one that doesn't exist. */
    public Trip requireMember(String tripId, String userId) {
        Trip trip = requireTrip(tripId);
        if (!memberRepository.existsByTripIdAndUserId(tripId, userId)) {
            throw ApiException.notFound("That trip does not exist.");
        }
        return trip;
    }

    public TripMember requireOwner(String tripId, String userId) {
        requireTrip(tripId);
        TripMember member = memberRepository.findByTripIdAndUserId(tripId, userId)
                .orElseThrow(() -> ApiException.notFound("That trip does not exist."));
        if (!member.isOwner()) throw ApiException.forbidden("Only the trip owner can do that.");
        return member;
    }

    public boolean isOwner(String tripId, String userId) {
        return memberRepository.findByTripIdAndUserId(tripId, userId).map(TripMember::isOwner).orElse(false);
    }

    public Set<String> memberIds(String tripId) {
        Set<String> ids = new LinkedHashSet<>();
        for (TripMember m : memberRepository.findByTripIdOrderByJoinedAtAsc(tripId)) ids.add(m.getUserId());
        return ids;
    }

    public long memberCount(String tripId) {
        return memberRepository.countByTripId(tripId);
    }
}
