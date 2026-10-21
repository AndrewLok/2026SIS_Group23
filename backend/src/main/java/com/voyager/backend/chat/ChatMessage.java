package com.voyager.backend.chat;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;

// One message. authorId is kept even if that person later leaves the trip, so the history still
// reads the same; the screen shows "Someone" when it can no longer find them.

@Entity
@Table(name = "chat_messages",
        indexes = @Index(name = "idx_chat_messages_channel_created", columnList = "channel_id, created_at"))
public class ChatMessage {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "channel_id", nullable = false)
    private UUID channelId;

    @Column(name = "author_id", nullable = false)
    private UUID authorId;

    @Column(nullable = false, length = 2000)
    private String body;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    public ChatMessage() {}

    public ChatMessage(UUID channelId, UUID authorId, String body, Instant createdAt) {
        this.channelId = channelId;
        this.authorId = authorId;
        this.body = body;
        this.createdAt = createdAt;
    }

    public UUID getId() { return id; }
    public UUID getChannelId() { return channelId; }
    public UUID getAuthorId() { return authorId; }
    public String getBody() { return body; }
    public Instant getCreatedAt() { return createdAt; }
}
