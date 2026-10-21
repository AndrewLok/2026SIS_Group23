package com.voyager.backend.chat.responsedto;

import java.util.UUID;

import com.voyager.backend.chat.ChatChannel;

public record ChannelResponse(UUID id, UUID tripId, String name) {
    public static ChannelResponse from(ChatChannel channel) {
        return new ChannelResponse(channel.getId(), channel.getTripId(), channel.getName());
    }
}
