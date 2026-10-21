package com.voyager.backend.chat;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ChatMessageRepository extends JpaRepository<ChatMessage, UUID> {

    // Oldest first. The id only breaks a tie between two messages stamped the same instant.
    List<ChatMessage> findByChannelIdOrderByCreatedAtAscIdAsc(UUID channelId);

    // The newest message in a channel, whoever wrote it.
    Optional<ChatMessage> findFirstByChannelIdOrderByCreatedAtDescIdDesc(UUID channelId);

    // Unread means: someone else wrote it, after the last time this person looked.
    long countByChannelIdAndAuthorIdNotAndCreatedAtAfter(UUID channelId, UUID authorId, Instant after);

    Optional<ChatMessage> findFirstByChannelIdAndAuthorIdNotAndCreatedAtAfterOrderByCreatedAtAscIdAsc(
            UUID channelId, UUID authorId, Instant after);
}
