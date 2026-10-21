package com.voyager.backend.chat;

import org.springframework.stereotype.Component;

import jakarta.servlet.http.HttpSessionEvent;
import jakarta.servlet.http.HttpSessionListener;

// Signing out, or a login session running out, ends the chat sockets that session opened. Without
// this a socket would keep listening until its page was closed, long after the cookie was gone.
// Spring Boot registers any HttpSessionListener bean with the server by itself.

@Component
public class SignOutClosesSockets implements HttpSessionListener {

    private final ChatSocketHandler handler;

    public SignOutClosesSockets(ChatSocketHandler handler) {
        this.handler = handler;
    }

    @Override
    public void sessionDestroyed(HttpSessionEvent event) {
        handler.closeSocketsOf(event.getSession().getId());
    }
}
