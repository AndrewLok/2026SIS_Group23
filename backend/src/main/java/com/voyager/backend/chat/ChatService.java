package com.voyager.backend.chat;

import java.time.Instant;
import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.voyager.backend.chat.responseDTO.ChannelResponse;
import com.voyager.backend.chat.responseDTO.MessageResponse;
import com.voyager.backend.chat.responseDTO.UnreadResponse;
import com.voyager.backend.common.ApiException;
import com.voyager.backend.trip.TripAccess;

/** Mirrors the front end's services/mock/chat.ts. */
@Service
public class ChatService {

    private final ChannelRepository channelRepository;
    private final MessageRepository messageRepository;
    private final ChannelReadRepository readRepository;
    private final TripAccess access;

    public ChatService(ChannelRepository channelRepository, MessageRepository messageRepository,
                       ChannelReadRepository readRepository, TripAccess access) {
        this.channelRepository = channelRepository;
        this.messageRepository = messageRepository;
        this.readRepository = readRepository;
        this.access = access;
    }

    @Transactional(readOnly = true)
    public List<ChannelResponse> listChannels(String callerId, String tripId) {
        access.requireMember(tripId, callerId);
        return channelRepository.findByTripId(tripId).stream().map(ChannelResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public List<MessageResponse> listMessages(String callerId, String channelId) {
        requireChannel(channelId, callerId);
        return messageRepository.findByChannelIdOrderByCreatedAtAsc(channelId).stream()
                .map(MessageResponse::from).toList();
    }

    @Transactional
    public MessageResponse send(String callerId, String channelId, String body) {
        requireChannel(channelId, callerId);
        String trimmed = body == null ? "" : body.trim();
        if (trimmed.isEmpty()) throw ApiException.invalid("Type something first.");
        return MessageResponse.from(messageRepository.save(new Message(null, channelId, callerId, trimmed, Instant.now())));
    }

    /**
     * The unread count and where the divider goes. The divider is resolved from the read marker
     * rather than by counting back from the end: the count skips your own messages, so an
     * offset from the tail lands past the real boundary whenever you have spoken recently.
     */
    @Transactional(readOnly = true)
    public UnreadResponse unread(String callerId, String channelId) {
        requireChannel(channelId, callerId);
        Instant lastRead = readRepository.findById(ChannelRead.key(callerId, channelId))
                .map(ChannelRead::getLastReadAt).orElse(null);
        List<Message> unseen = messageRepository.findByChannelIdOrderByCreatedAtAsc(channelId).stream()
                .filter(m -> !m.getAuthorId().equals(callerId))
                .filter(m -> lastRead == null || m.getCreatedAt().isAfter(lastRead))
                .toList();
        return new UnreadResponse(unseen.size(), unseen.isEmpty() ? null : unseen.get(0).getId());
    }

    /** Called when the chat screen is opened, which is what clears the dashboard count. */
    @Transactional
    public void markRead(String callerId, String channelId) {
        requireChannel(channelId, callerId);
        Instant now = Instant.now();
        readRepository.findById(ChannelRead.key(callerId, channelId)).ifPresentOrElse(
                read -> read.setLastReadAt(now),
                () -> readRepository.save(new ChannelRead(callerId, channelId, now)));
    }

    private Channel requireChannel(String channelId, String callerId) {
        Channel channel = channelRepository.findById(channelId)
                .orElseThrow(() -> ApiException.notFound("That channel does not exist."));
        access.requireMember(channel.getTripId(), callerId);
        return channel;
    }
}
