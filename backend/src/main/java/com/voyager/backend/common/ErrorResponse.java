package com.voyager.backend.common;

// Every error body looks like this. The codes are the ones the frontend's ApiError already
// branches on (src/types/index.ts), and the messages are written to be shown to the person as they are.

public record ErrorResponse(String code, String message) {

    public static ErrorResponse invalid(String message) { return new ErrorResponse("invalid", message); }
    public static ErrorResponse invalidCredentials() {
        return new ErrorResponse("invalid_credentials", "That email and password do not match.");
    }
    public static ErrorResponse conflict(String message) { return new ErrorResponse("conflict", message); }
    public static ErrorResponse forbidden(String message) { return new ErrorResponse("forbidden", message); }
    public static ErrorResponse notFound(String message) { return new ErrorResponse("not_found", message); }
}
