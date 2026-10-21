package com.voyager.backend.chat;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** The last time one member opened one channel, which is what the unread count counts from. */
@Entity
@Table(name = "channel_reads")
public class ChannelRead {

    @Id
    private String id; // "userId:channelId", as the mock keys it.

    @Column(nullable = false)
    private Instant lastReadAt;

    public ChannelRead() {}

    public ChannelRead(String userId, String channelId, Instant lastReadAt) {
        this.id = key(userId, channelId);
        this.lastReadAt = lastReadAt;
    }

    public static String key(String userId, String channelId) {
        return userId + ":" + channelId;
    }

    public String getId() { return id; }
    public Instant getLastReadAt() { return lastReadAt; }
    public void setLastReadAt(Instant lastReadAt) { this.lastReadAt = lastReadAt; }
}
