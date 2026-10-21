package com.voyager.backend.common;

import jakarta.servlet.http.HttpSession;

/**
 * Who is signed in. The id lives in the servlet session, so the browser carries it as the
 * JSESSIONID cookie and the front end never handles a token.
 */
public final class Session {

    static final String USER_ID = "voyager.userId";

    private Session() {}

    public static String userId(HttpSession session) {
        Object id = session.getAttribute(USER_ID);
        return id instanceof String s ? s : null;
    }

    /** The signed-in user's id, or forbidden when nobody is. */
    public static String require(HttpSession session) {
        String id = userId(session);
        if (id == null) throw ApiException.forbidden("Sign in to do that.");
        return id;
    }

    public static void signIn(HttpSession session, String userId) {
        session.setAttribute(USER_ID, userId);
    }

    public static void signOut(HttpSession session) {
        session.removeAttribute(USER_ID);
    }
}
