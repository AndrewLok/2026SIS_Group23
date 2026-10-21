package com.voyager.backend.chat;

import java.io.IOException;
import java.security.Principal;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.ConcurrentWebSocketSessionDecorator;
import org.springframework.web.socket.handler.TextWebSocketHandler;
import org.springframework.web.socket.server.support.HttpSessionHandshakeInterceptor;

// The "look again" nudge. The socket carries no chat content at all: it tells a screen that
// something new is in a channel, and the screen then asks the REST endpoints for it. That keeps
// one place (ChatService) deciding who may read what, and means a missed nudge costs nothing,
// because the next fetch gets everything.
//
// What a client sends, as JSON text:
//   {"type":"subscribe","channelId":"<uuid>"}      listen to one channel (members of its trip only)
//   {"type":"unsubscribe","channelId":"<uuid>"}
//   {"type":"ping"}                                keeps idle connections alive through proxies
// What it receives:
//   {"type":"subscribed","channelId":"<uuid>"}
//   {"type":"error","code":"not_found"|"invalid","channelId":"<uuid>"}   (channelId when there is one)
//   {"type":"message","channelId":"<uuid>","messageId":"<uuid>"}         something new in a channel
//   {"type":"pong"}
//
// A socket belongs to the login session it was opened with (the handshake interceptor in
// ChatSocketConfig records the session's id on it). When that session ends, by logging out or
// by expiring, SignOutClosesSockets calls closeSocketsOf and the socket is closed with it.
//
// The frames are tiny and fixed, so they are read with two patterns rather than a JSON library,
// and written from validated UUIDs, which cannot contain anything that needs escaping.

@Component
public class ChatSocketHandler extends TextWebSocketHandler {

    private static final Pattern TYPE = Pattern.compile("\"type\"\\s*:\\s*\"([a-z]+)\"");
    private static final Pattern CHANNEL = Pattern.compile("\"channelId\"\\s*:\\s*\"([0-9a-fA-F-]{36})\"");

    // A client that stops reading is cut off rather than allowed to pile up memory or stall senders.
    private static final int SEND_TIME_LIMIT_MS = 5_000;
    private static final int SEND_BUFFER_LIMIT_BYTES = 64 * 1024;

    private final ChatService chat;

    // Sending to one session from two threads at once is not allowed, so every session is wrapped.
    private final Map<String, ConcurrentWebSocketSessionDecorator> senders = new ConcurrentHashMap<>();
    // Which sessions listen to which channel.
    private final Map<UUID, Set<String>> listeners = new ConcurrentHashMap<>();

    public ChatSocketHandler(ChatService chat) {
        this.chat = chat;
    }

    /* Connections */

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        if (userOf(session) == null) {
            session.close(CloseStatus.POLICY_VIOLATION);
            return;
        }
        senders.put(session.getId(), new ConcurrentWebSocketSessionDecorator(session, SEND_TIME_LIMIT_MS, SEND_BUFFER_LIMIT_BYTES));
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        forget(session.getId());
    }

    @Override
    public void handleTransportError(WebSocketSession session, Throwable exception) throws Exception {
        forget(session.getId());
        session.close(CloseStatus.SERVER_ERROR);
    }

    private void forget(String sessionId) {
        senders.remove(sessionId);
        for (UUID channelId : listeners.keySet()) {
            stopListening(channelId, sessionId);
        }
    }

    private void listen(UUID channelId, String sessionId) {
        // compute() is atomic for the key, so a channel's set cannot be thrown away between being found and being added to.
        listeners.compute(channelId, (id, ids) -> {
            Set<String> set = ids == null ? ConcurrentHashMap.newKeySet() : ids;
            set.add(sessionId);
            return set;
        });
    }

    // A channel nobody listens to is dropped from the map, so it does not grow with every channel ever opened.
    private void stopListening(UUID channelId, String sessionId) {
        listeners.computeIfPresent(channelId, (id, ids) -> {
            ids.remove(sessionId);
            return ids.isEmpty() ? null : ids;
        });
    }

    // Closes every socket that was opened with this login session. Called when the session ends.
    public void closeSocketsOf(String httpSessionId) {
        for (ConcurrentWebSocketSessionDecorator sender : senders.values()) {
            if (httpSessionId.equals(sender.getAttributes().get(HttpSessionHandshakeInterceptor.HTTP_SESSION_ID_ATTR_NAME))) {
                forget(sender.getId());
                try {
                    sender.close(CloseStatus.POLICY_VIOLATION);
                } catch (IOException | RuntimeException ignored) {
                    // Already gone.
                }
            }
        }
    }

    // The signed-in person's id, or null when the socket has no usable principal.
    private static UUID userOf(WebSocketSession session) {
        Principal principal = session.getPrincipal();
        if (principal == null) {
            return null;
        }
        try {
            return UUID.fromString(principal.getName());
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    /* What clients send */

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) {
        ConcurrentWebSocketSessionDecorator sender = senders.get(session.getId());
        UUID userId = userOf(session);
        if (sender == null || userId == null) {
            return;
        }

        String text = message.getPayload();
        String type = firstGroup(TYPE, text);
        if (type == null) {
            send(sender, "{\"type\":\"error\",\"code\":\"invalid\"}");
            return;
        }
        if (type.equals("ping")) {
            send(sender, "{\"type\":\"pong\"}");
            return;
        }
        if (!type.equals("subscribe") && !type.equals("unsubscribe")) {
            send(sender, "{\"type\":\"error\",\"code\":\"invalid\"}");
            return;
        }

        UUID channelId = channelIn(text);
        if (channelId == null) {
            send(sender, "{\"type\":\"error\",\"code\":\"invalid\"}");
            return;
        }

        if (type.equals("unsubscribe")) {
            stopListening(channelId, session.getId());
            return;
        }

        // A channel you cannot read looks the same as one that does not exist.
        if (!chat.canRead(channelId, userId)) {
            send(sender, "{\"type\":\"error\",\"code\":\"not_found\",\"channelId\":\"" + channelId + "\"}");
            return;
        }
        listen(channelId, session.getId());
        send(sender, "{\"type\":\"subscribed\",\"channelId\":\"" + channelId + "\"}");
    }

    private static String firstGroup(Pattern pattern, String text) {
        Matcher matcher = pattern.matcher(text);
        return matcher.find() ? matcher.group(1) : null;
    }

    private static UUID channelIn(String text) {
        String raw = firstGroup(CHANNEL, text);
        if (raw == null) {
            return null;
        }
        try {
            return UUID.fromString(raw);
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    /* What clients are told */

    // Runs only once the message is safely saved, so a screen that refetches is sure to find it.
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onMessageSent(MessageSent event) {
        Set<String> ids = listeners.get(event.channelId());
        if (ids == null) {
            return;
        }
        String frame = "{\"type\":\"message\",\"channelId\":\"" + event.channelId()
                + "\",\"messageId\":\"" + event.messageId() + "\"}";
        for (String sessionId : ids) {
            ConcurrentWebSocketSessionDecorator sender = senders.get(sessionId);
            if (sender == null) {
                stopListening(event.channelId(), sessionId);
                continue;
            }
            // Someone who has left the trip since subscribing stops hearing about it.
            UUID userId = userOf(sender);
            if (userId == null || !chat.canRead(event.channelId(), userId)) {
                stopListening(event.channelId(), sessionId);
                continue;
            }
            send(sender, frame);
        }
    }

    // A failed send means the client is gone or too slow. Close it; it will reconnect and refetch.
    private void send(ConcurrentWebSocketSessionDecorator sender, String frame) {
        try {
            sender.sendMessage(new TextMessage(frame));
        } catch (IOException | RuntimeException e) {
            forget(sender.getId());
            try {
                sender.close(CloseStatus.SESSION_NOT_RELIABLE);
            } catch (IOException ignored) {
                // Already closed.
            }
        }
    }
}
