package com.voyager.backend.common;

import java.util.UUID;

import jakarta.servlet.http.HttpSession;
import jakarta.servlet.http.HttpServletRequest;

public final class Session{
    private static final String USER_ID_KEY = "voyager.userId";

    private Session(){

    }

    public static void signIn(
        HTTPServletRequest request,
        UUID userId
    ){
        HttpSession session = request.getSession();
        request.changeSessionId();
        session.setAttribute(USER_ID, userId);
    }

    public statis UUID userId(HttpServletRequest request){
        HttpSession session = request.getSession(false);
        if(session == null){
            return null;
        }
        return (UUID) session.getAttribute(USER_ID);

    }
    public static void signOut(HttpServletRequest request){
        HttpSession session = request.getSession(false);

        if (session != null){
            session.invalidate();
            
        }
    }




}