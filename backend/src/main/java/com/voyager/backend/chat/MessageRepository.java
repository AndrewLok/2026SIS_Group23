package com.voyager.backend.chat;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

public interface MessageRepository extends JpaRepository<Message, String> {
    List<Message> findByChannelIdOrderByCreatedAtAsc(String channelId);
}
