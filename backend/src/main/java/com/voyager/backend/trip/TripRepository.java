package com.voyager.backend.trip;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface TripRepository extends JpaRepository<Trip, Long> {
    Optional<Trip> findByJoinCode(String joinCode);
}
