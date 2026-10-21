package com.voyager.backend.fuel;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

public interface FuelLegRepository extends JpaRepository<FuelLeg, String> {
    List<FuelLeg> findByTripIdOrderByCreatedAtAsc(String tripId);
}
