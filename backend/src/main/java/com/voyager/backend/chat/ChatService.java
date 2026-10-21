package com.voyager.backend.chat;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;

import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.voyager.backend.common.ApiException;
import com.voyager.backend.trip.TripMemberRepository;

// The rules for chat, in one place:
//   - Only people on a trip can see its channels or messages. For anyone else they simply do not
//     exist (404), the same way a trip you are not on does not exist.
//   - Anyone on the trip can write. Messages cannot be edited or deleted yet.
//   - What you have read is kept per person per channel, on the server, so the unread count and
//     the "New" divider agree between your phone and your laptop.
//
// Unread is worked out from message times, so the times have to be trustworthy: within a channel
// they only ever go up, in the order the messages become visible (send locks the channel and stamps
// the message after the lock), and "I have read it all" is recorded as the time of the newest
// message that is visible right now, not the clock. That way a message that is still being saved
// when someone marks the channel read can never end up stamped before their marker and be lost.

@Service
public class ChatService {

    public static final String GENERAL = "general";
    public static final int MAX_BODY_LENGTH = 2000;

    // How much of a channel one person has not seen. firstUnreadId is null when there is nothing new.
    public record ReadState(long unreadCount, UUID firstUnreadId) {}

    private final ChatChannelRepository channels;
    private final ChatMessageRepository messages;
    private final ChatReadRepository reads;
    private final TripMemberRepository members;
    private final ApplicationEventPublisher events;

    public ChatService(ChatChannelRepository channels, ChatMessageRepository messages, ChatReadRepository reads,
            TripMemberRepository members, ApplicationEventPublisher events) {
        this.channels = channels;
        this.messages = messages;
        this.reads = reads;
        this.members = members;
        this.events = events;
    }

    // Stored times are kept to the microsecond, which is what the database holds, so a message reads
    // the same in the response that creates it as it does when listed later.
    private static Instant now() {
        return Instant.now().truncatedTo(ChronoUnit.MICROS);
    }

    /* Looking things up */

    private ChatChannel requireChannel(UUID channelId, UUID userId) {
        return channels.findById(channelId)
                .filter(channel -> members.findByTripIdAndUserId(channel.getTripId(), userId).isPresent())
                .orElseThrow(() -> ApiException.notFound("That chat does not exist."));
    }

    // For the socket, which needs a yes or no rather than an exception. It is asked from "after commit"
    // callbacks too. There it simply reads using the connection the finished transaction still holds,
    // rather than asking the pool for a second one, which a busy pool might never hand over.
    @Transactional(readOnly = true)
    public boolean canRead(UUID channelId, UUID userId) {
        return channels.findById(channelId)
                .filter(channel -> members.findByTripIdAndUserId(channel.getTripId(), userId).isPresent())
                .isPresent();
    }

    /* Channels */

    // Called when a trip is made. It runs inside that transaction, so a trip never exists without it.
    @Transactional
    public ChatChannel createGeneral(UUID tripId) {
        return channels.save(new ChatChannel(tripId, GENERAL));
    }

    @Transactional(readOnly = true)
    public List<ChatChannel> channelsFor(UUID tripId, UUID userId) {
        if (members.findByTripIdAndUserId(tripId, userId).isEmpty()) {
            throw ApiException.notFound("That trip does not exist.");
        }
        return channels.findByTripIdOrderByNameAsc(tripId);
    }

    /* Messages */

    @Transactional(readOnly = true)
    public List<ChatMessage> messagesIn(UUID channelId, UUID userId) {
        requireChannel(channelId, userId);
        return messages.findByChannelIdOrderByCreatedAtAscIdAsc(channelId);
    }

    @Transactional
    public ChatMessage send(UUID channelId, UUID userId, String body) {
        requireChannel(channelId, userId);
        String trimmed = body == null ? "" : body.trim();
        if (trimmed.isEmpty()) {
            throw ApiException.invalid("Type something first.");
        }
        if (trimmed.length() > MAX_BODY_LENGTH) {
            throw ApiException.invalid("That message is too long. Keep it under " + MAX_BODY_LENGTH + " characters.");
        }

        // One message at a time per channel. Taking the lock before reading the clock is what makes
        // the stamps rise in the order messages commit.
        channels.findLockedById(channelId).orElseThrow(() -> ApiException.notFound("That chat does not exist."));
        Instant at = now();
        Instant newest = messages.findFirstByChannelIdOrderByCreatedAtDescIdDesc(channelId)
                .map(ChatMessage::getCreatedAt)
                .orElse(null);
        if (newest != null && !at.isAfter(newest)) {
            at = newest.plus(1, ChronoUnit.MICROS); // A clock that stepped back must not reorder the channel.
        }

        ChatMessage saved = messages.save(new ChatMessage(channelId, userId, trimmed, at));
        events.publishEvent(new MessageSent(channelId, saved.getId()));
        return saved;
    }

    /* What has been read */

    private Instant lastReadAt(UUID channelId, UUID userId) {
        return reads.findByUserIdAndChannelId(userId, channelId)
                .map(ChatRead::getLastReadAt)
                .orElse(Instant.EPOCH);
    }

    @Transactional(readOnly = true)
    public ReadState readState(UUID channelId, UUID userId) {
        requireChannel(channelId, userId);
        Instant since = lastReadAt(channelId, userId);
        long unread = messages.countByChannelIdAndAuthorIdNotAndCreatedAtAfter(channelId, userId, since);
        UUID first = messages
                .findFirstByChannelIdAndAuthorIdNotAndCreatedAtAfterOrderByCreatedAtAscIdAsc(channelId, userId, since)
                .map(ChatMessage::getId)
                .orElse(null);
        return new ReadState(unread, first);
    }

    // "I have seen everything up to now." Recorded as the newest message that exists right now. With
    // no messages there is nothing to mark, and every message that arrives later is new anyway.
    //
    // Two first-time calls at once (two devices, a double tap) both try to create the marker and one
    // hits the unique constraint. The controller runs the call again in that case, and the second
    // run finds the marker the winner made.
    @Transactional
    public void markRead(UUID channelId, UUID userId) {
        requireChannel(channelId, userId);
        Instant newest = messages.findFirstByChannelIdOrderByCreatedAtDescIdDesc(channelId)
                .map(ChatMessage::getCreatedAt)
                .orElse(null);
        if (newest == null) {
            return;
        }
        ChatRead read = reads.findByUserIdAndChannelId(userId, channelId)
                .orElseGet(() -> new ChatRead(userId, channelId, newest));
        if (newest.isAfter(read.getLastReadAt())) {
            read.setLastReadAt(newest);
        }
        reads.saveAndFlush(read);
    }
}
