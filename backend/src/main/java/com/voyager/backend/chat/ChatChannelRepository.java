package com.voyager.backend.chat;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;

import jakarta.persistence.LockModeType;

public interface ChatChannelRepository extends JpaRepository<ChatChannel, UUID> {
    List<ChatChannel> findByTripIdOrderByNameAsc(UUID tripId);

    // The channel row, locked until the end of the transaction. Sending takes it, so the messages in
    // one channel are stamped and saved strictly one after another (see ChatService.send).
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<ChatChannel> findLockedById(UUID id);
}
