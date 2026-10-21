package com.voyager.backend.chat;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ChannelRepository extends JpaRepository<Channel, String> {
    List<Channel> findByTripId(String tripId);
}
