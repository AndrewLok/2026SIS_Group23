package com.voyager.backend.trip;

import java.util.Optional;
import java.util.UUID;

import jakarta.persistence.LockModeType;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.stereotype.Repository;

@Repository
public interface TripRepository extends JpaRepository<Trip, UUID> {
    Optional<Trip> findByInviteCode(String inviteCode);
    boolean existsByInviteCode(String inviteCode);

    // The trip row, locked until the end of the transaction. Anything that changes who is on a trip
    // takes this first, so two such requests for one trip run one after the other, not side by side.
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<Trip> findLockedById(UUID id);
}
