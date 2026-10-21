package com.voyager.backend.chat;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

// Opens /ws/chat. The handshake is an ordinary HTTP request, so SecurityConfig's "everything needs
// a signed-in user" covers it, and the person on the socket is whoever the session cookie says.
//
// No allowed origins are listed on purpose. Spring then only accepts a browser handshake from the
// same origin as the page (the Vite proxy in development, the real host in production). That is
// what stops another website from opening a socket with a visitor's cookie.

@Configuration
@EnableWebSocket
public class ChatSocketConfig implements WebSocketConfigurer {

    private final ChatSocketHandler handler;

    public ChatSocketConfig(ChatSocketHandler handler) {
        this.handler = handler;
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(handler, "/ws/chat");
    }
}
