package com.voyager.backend.fuel;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

public interface FuelRiderRepository extends JpaRepository<FuelRider, UUID> {
    List<FuelRider> findByLegId(UUID legId);
    List<FuelRider> findByLegIdIn(Collection<UUID> legIds);
    void deleteByLegId(UUID legId);
}
