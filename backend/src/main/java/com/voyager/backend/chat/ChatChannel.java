package com.voyager.backend.chat;

import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

// A conversation inside a trip. Every trip gets one called "general" when it is created. The table
// is here, rather than a single chat per trip, because the frontend already lists channels and
// more of them are planned. Only members of the trip can see a channel.

@Entity
@Table(name = "chat_channels",
        uniqueConstraints = @UniqueConstraint(columnNames = {"trip_id", "name"}))
public class ChatChannel {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "trip_id", nullable = false)
    private UUID tripId;

    @Column(nullable = false)
    private String name;

    public ChatChannel() {}

    public ChatChannel(UUID tripId, String name) {
        this.tripId = tripId;
        this.name = name;
    }

    public UUID getId() { return id; }
    public UUID getTripId() { return tripId; }
    public String getName() { return name; }
}
