package com.voyager.backend.chat;

import java.time.Instant;

import com.voyager.backend.common.Ids;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;

@Entity
@Table(name = "messages", indexes = @Index(name = "idx_messages_channel_id", columnList = "channel_id"))
public class Message {

    @Id
    private String id;

    @Column(name = "channel_id", nullable = false)
    private String channelId;

    @Column(nullable = false)
    private String authorId;

    @Column(nullable = false, length = 4000)
    private String body;

    @Column(nullable = false)
    private Instant createdAt;

    public Message() {}

    public Message(String id, String channelId, String authorId, String body, Instant createdAt) {
        this.id = id == null ? Ids.newId() : id;
        this.channelId = channelId;
        this.authorId = authorId;
        this.body = body;
        this.createdAt = createdAt;
    }

    public String getId() { return id; }
    public String getChannelId() { return channelId; }
    public String getAuthorId() { return authorId; }
    public String getBody() { return body; }
    public Instant getCreatedAt() { return createdAt; }
}
