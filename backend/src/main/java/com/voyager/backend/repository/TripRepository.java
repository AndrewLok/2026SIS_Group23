package com.voyager.backend.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.voyager.backend.model.Trip;

@Repository
public interface TripRepository extends JpaRepository<Trip, Long> {
    Optional<Trip> findByJoinCode(String joinCode);
}