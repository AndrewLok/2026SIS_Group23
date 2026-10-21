package com.voyager.backend.chat.responsedto;

import java.time.Instant;
import java.util.UUID;

import com.voyager.backend.chat.ChatMessage;

public record MessageResponse(UUID id, UUID channelId, UUID authorId, String body, Instant createdAt) {
    public static MessageResponse from(ChatMessage message) {
        return new MessageResponse(
            message.getId(),
            message.getChannelId(),
            message.getAuthorId(),
            message.getBody(),
            message.getCreatedAt()
        );
    }
}
