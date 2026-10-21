package com.voyager.backend.trip;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface TripMemberRepository extends JpaRepository<TripMember, String> {
    List<TripMember> findByTripIdOrderByJoinedAtAsc(String tripId);
    List<TripMember> findByUserId(String userId);
    Optional<TripMember> findByTripIdAndUserId(String tripId, String userId);
    boolean existsByTripIdAndUserId(String tripId, String userId);
    long countByTripId(String tripId);
    long countByTripIdAndRole(String tripId, String role);
}
