package com.voyager.backend.chat.responsedto;

import java.util.UUID;

import com.voyager.backend.chat.ChatService.ReadState;

// What this person has not seen in a channel: how many messages, and which one the "New" divider
// goes above (null when there is nothing new).

public record ReadStateResponse(long unreadCount, UUID firstUnreadId) {
    public static ReadStateResponse from(ReadState state) {
        return new ReadStateResponse(state.unreadCount(), state.firstUnreadId());
    }
}
