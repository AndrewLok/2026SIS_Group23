package com.voyager.backend.chat.responseDTO;

import com.voyager.backend.chat.Channel;

/** Matches the front end's Channel type. */
public record ChannelResponse(String id, String tripId, String name) {
    public static ChannelResponse from(Channel channel) {
        return new ChannelResponse(channel.getId(), channel.getTripId(), channel.getName());
    }
}
