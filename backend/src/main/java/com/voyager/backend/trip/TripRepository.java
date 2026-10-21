package com.voyager.backend.trip;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface TripRepository extends JpaRepository<Trip, String> {
    Optional<Trip> findByInviteCode(String inviteCode);
    boolean existsByInviteCode(String inviteCode);
    List<Trip> findByIdIn(Collection<String> ids);
}
