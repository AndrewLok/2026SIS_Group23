package com.voyager.backend.chat.responseDTO;

/**
 * How many messages the caller hasn't seen, and the one the unread divider goes above
 * (null when nothing is unread). Both skip the caller's own messages.
 */
public record UnreadResponse(int count, String firstUnreadId) {}
