package com.voyager.backend.common;

/** The error shape the front end branches on: a code plus a message to show. */
public record ErrorResponse(String code, String message) {}
