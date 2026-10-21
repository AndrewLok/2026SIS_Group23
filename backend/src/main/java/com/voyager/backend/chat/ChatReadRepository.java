package com.voyager.backend.chat;

import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ChatReadRepository extends JpaRepository<ChatRead, UUID> {
    Optional<ChatRead> findByUserIdAndChannelId(UUID userId, UUID channelId);
}
