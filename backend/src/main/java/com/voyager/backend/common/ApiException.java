package com.voyager.backend.common;

import org.springframework.http.HttpStatus;

// Thrown anywhere in the backend to stop a request with a specific status and an ErrorResponse body.
// ApiExceptionHandler turns it into the response, so services never have to build one by hand.

public class ApiException extends RuntimeException {

    private final HttpStatus status;
    private final ErrorResponse error;

    public ApiException(HttpStatus status, ErrorResponse error) {
        super(error.message());
        this.status = status;
        this.error = error;
    }

    public HttpStatus status() { return status; }
    public ErrorResponse error() { return error; }

    public static ApiException invalid(String message) {
        return new ApiException(HttpStatus.BAD_REQUEST, ErrorResponse.invalid(message));
    }
    public static ApiException forbidden(String message) {
        return new ApiException(HttpStatus.FORBIDDEN, ErrorResponse.forbidden(message));
    }
    public static ApiException notFound(String message) {
        return new ApiException(HttpStatus.NOT_FOUND, ErrorResponse.notFound(message));
    }
    public static ApiException conflict(String message) {
        return new ApiException(HttpStatus.CONFLICT, ErrorResponse.conflict(message));
    }
}
