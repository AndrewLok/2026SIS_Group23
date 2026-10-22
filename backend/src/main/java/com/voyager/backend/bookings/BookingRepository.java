package com.voyager.backend.bookings;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface BookingRepository extends JpaRepository<Booking, UUID> {
    List<Booking> findByTripId(UUID tripId);

    // Just the trip a booking belongs to, without loading it, so BookingService can lock the trip
    // before it reads the booking (the same reason as IdeaRepository.findTripIdById).
    @Query("select b.tripId from Booking b where b.id = :id")
    Optional<UUID> findTripIdById(@Param("id") UUID id);
}
