package com.voyager.backend.chat.responseDTO;

import com.voyager.backend.chat.Message;
import com.voyager.backend.common.Times;

/** Matches the front end's Message type. */
public record MessageResponse(String id, String channelId, String authorId, String body, String createdAt) {
    public static MessageResponse from(Message message) {
        return new MessageResponse(message.getId(), message.getChannelId(), message.getAuthorId(),
                message.getBody(), Times.iso(message.getCreatedAt()));
    }
}
