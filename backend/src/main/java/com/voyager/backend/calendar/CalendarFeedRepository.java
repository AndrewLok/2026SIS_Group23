package com.voyager.backend.calendar;

import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

public interface CalendarFeedRepository extends JpaRepository<CalendarFeed, UUID> {
    Optional<CalendarFeed> findByToken(String token);
    Optional<CalendarFeed> findByTripIdAndUserId(UUID tripId, UUID userId);
    void deleteByTripIdAndUserId(UUID tripId, UUID userId);
}
