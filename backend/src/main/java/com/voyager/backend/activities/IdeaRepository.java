package com.voyager.backend.activities;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface IdeaRepository extends JpaRepository<Idea, UUID> {
    List<Idea> findByTripId(UUID tripId);

    // Just the trip an activity belongs to, without loading the activity. IdeaService needs to know
    // the trip so it can lock it, and must not have read the activity before the lock is held, or
    // it could be working from a copy that someone else has since changed or deleted.
    @Query("select i.tripId from Idea i where i.id = :id")
    Optional<UUID> findTripIdById(@Param("id") UUID id);
}
