package com.voyager.backend.fuel;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface FuelLegRepository extends JpaRepository<FuelLeg, UUID> {
    List<FuelLeg> findByTripId(UUID tripId);

    // Just the trip a leg belongs to, without loading it, so FuelService can lock the trip before it
    // reads the leg (the same reason as IdeaRepository.findTripIdById).
    @Query("select l.tripId from FuelLeg l where l.id = :id")
    Optional<UUID> findTripIdById(@Param("id") UUID id);
}
