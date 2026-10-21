package com.voyager.backend.chat;

import com.voyager.backend.common.Ids;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;

/** A trip's chat room. Every trip gets a "general" one when it is created. */
@Entity
@Table(name = "channels", indexes = @Index(name = "idx_channels_trip_id", columnList = "trip_id"))
public class Channel {

    @Id
    private String id;

    @Column(name = "trip_id", nullable = false)
    private String tripId;

    @Column(nullable = false)
    private String name;

    public Channel() {}

    public Channel(String id, String tripId, String name) {
        this.id = id == null ? Ids.newId() : id;
        this.tripId = tripId;
        this.name = name;
    }

    public String getId() { return id; }
    public String getTripId() { return tripId; }
    public String getName() { return name; }
}
