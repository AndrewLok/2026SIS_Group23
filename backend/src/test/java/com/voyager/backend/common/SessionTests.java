package com.voyager.backend.common;

import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpSession;

import static org.junit.jupiter.api.Assertions.*;

class SessionTests{

    @Test
    void checkingLoginDoesNotCreateSession(){
        MockHttpServletRequest request = new MockHttpServletRequest();
        assertNull(Session.userId(request));
        assertNull(request.getSession(false));
    }
    

    @Test
    void signInCreatesSessionAndStoresUserId(){
        MockHttpServletRequest request = new MockHttpServletRequest();
        UUID userId = UUID.randomUUID();

        Session.signIn(request, userId);

        
        assertEquals(userId, Session.userId(request));
    }

    @Test 
    void loginChangesSessionId(){
        MockHttpServletRequest request = new MockHttpServletRequest();
        
        String originalSessionId = request.getSession().getId();
        Session.signIn(request, UUID.randomUUID());
        String newSessionId = request.getSession(false).getId();

        assertNotEquals(originalSessionId, newSessionId);
    }

    @Test
    void logoutInvalidatesSession(){
        MockHttpServletRequest request = new MockHttpServletRequest();
        Session.signIn(request, UUID.randomUUID());

        MockHttpSession session = (MockHttpSession) request.getSession(false);
        Session.signOut(request);

        assertTrue(session.isInvalid());
        assertNull(Session.userId(request));
    }

    
}