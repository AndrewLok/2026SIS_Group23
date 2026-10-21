package com.voyager.backend.chat;

import java.util.List;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.voyager.backend.chat.requestdto.SendMessageRequest;
import com.voyager.backend.chat.responsedto.ChannelResponse;
import com.voyager.backend.chat.responsedto.MessageResponse;
import com.voyager.backend.chat.responsedto.ReadStateResponse;
import com.voyager.backend.security.CurrentUser;

// Every endpoint here needs a signed-in user (see SecurityConfig). The rules are in ChatService;
// this class only translates HTTP to and from it. New messages reach other people's screens through
// the socket in ChatSocketHandler, which only says "look again", and they then call these endpoints.

@RestController
@RequestMapping("/api")
public class ChatController {

    private final ChatService chat;

    public ChatController(ChatService chat) {
        this.chat = chat;
    }

    @GetMapping("/trips/{tripId}/channels")
    public ResponseEntity<List<ChannelResponse>> channels(@PathVariable UUID tripId, Authentication authentication) {
        List<ChannelResponse> body = chat.channelsFor(tripId, CurrentUser.id(authentication)).stream()
                .map(ChannelResponse::from)
                .toList();
        return ResponseEntity.ok(body);
    }

    // Oldest first, the whole history.
    @GetMapping("/channels/{channelId}/messages")
    public ResponseEntity<List<MessageResponse>> messages(@PathVariable UUID channelId, Authentication authentication) {
        List<MessageResponse> body = chat.messagesIn(channelId, CurrentUser.id(authentication)).stream()
                .map(MessageResponse::from)
                .toList();
        return ResponseEntity.ok(body);
    }

    @PostMapping("/channels/{channelId}/messages")
    public ResponseEntity<MessageResponse> send(@PathVariable UUID channelId, @RequestBody SendMessageRequest request,
            Authentication authentication) {
        ChatMessage message = chat.send(channelId, CurrentUser.id(authentication), request.body());
        return ResponseEntity.status(HttpStatus.CREATED).body(MessageResponse.from(message));
    }

    @GetMapping("/channels/{channelId}/read-state")
    public ResponseEntity<ReadStateResponse> readState(@PathVariable UUID channelId, Authentication authentication) {
        return ResponseEntity.ok(ReadStateResponse.from(chat.readState(channelId, CurrentUser.id(authentication))));
    }

    @PostMapping("/channels/{channelId}/read")
    public ResponseEntity<Void> markRead(@PathVariable UUID channelId, Authentication authentication) {
        chat.markRead(channelId, CurrentUser.id(authentication));
        return ResponseEntity.noContent().build();
    }
}
