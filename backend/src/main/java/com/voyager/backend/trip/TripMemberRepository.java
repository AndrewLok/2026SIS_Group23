package com.voyager.backend.trip;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

public interface TripMemberRepository extends JpaRepository<TripMember, UUID> {
    List<TripMember> findByTripId(UUID tripId);
    List<TripMember> findByUserId(UUID userId);
    Optional<TripMember> findByTripIdAndUserId(UUID tripId, UUID userId);
    long countByTripIdAndRole(UUID tripId, Role role);
}
