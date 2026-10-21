package com.voyager.backend.chat;

import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.voyager.backend.chat.responseDTO.ChannelResponse;
import com.voyager.backend.chat.responseDTO.MessageResponse;
import com.voyager.backend.chat.responseDTO.UnreadResponse;
import com.voyager.backend.common.Patch;
import com.voyager.backend.common.Session;

import jakarta.servlet.http.HttpSession;

/**
 * Chat over plain HTTP. The front end polls for new messages, which is plenty for a group of
 * five and keeps the demo free of socket set-up.
 */
@RestController
@RequestMapping("/api")
public class ChatController {

    private final ChatService chatService;

    public ChatController(ChatService chatService) {
        this.chatService = chatService;
    }

    @GetMapping("/trips/{tripId}/channels")
    public List<ChannelResponse> channels(HttpSession session, @PathVariable String tripId) {
        return chatService.listChannels(Session.require(session), tripId);
    }

    @GetMapping("/channels/{channelId}/messages")
    public List<MessageResponse> messages(HttpSession session, @PathVariable String channelId) {
        return chatService.listMessages(Session.require(session), channelId);
    }

    @PostMapping("/channels/{channelId}/messages")
    public ResponseEntity<MessageResponse> send(HttpSession session, @PathVariable String channelId,
                                                @RequestBody Map<String, Object> body) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(chatService.send(Session.require(session), channelId, new Patch(body).string("body")));
    }

    @GetMapping("/channels/{channelId}/unread")
    public UnreadResponse unread(HttpSession session, @PathVariable String channelId) {
        return chatService.unread(Session.require(session), channelId);
    }

    @PostMapping("/channels/{channelId}/read")
    public ResponseEntity<Void> markRead(HttpSession session, @PathVariable String channelId) {
        chatService.markRead(Session.require(session), channelId);
        return ResponseEntity.noContent().build();
    }
}
