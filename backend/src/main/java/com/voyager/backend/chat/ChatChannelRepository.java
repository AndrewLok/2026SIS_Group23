package com.voyager.backend.chat;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ChatChannelRepository extends JpaRepository<ChatChannel, UUID> {
    List<ChatChannel> findByTripIdOrderByNameAsc(UUID tripId);
}
