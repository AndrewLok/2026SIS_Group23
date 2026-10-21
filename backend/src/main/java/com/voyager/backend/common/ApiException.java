package com.voyager.backend.common;

import org.springframework.http.HttpStatus;

/**
 * A failure the front end branches on by code. The codes match ApiError in the front end's
 * types/index.ts, so a screen can tell "not found" from "not allowed" without reading text.
 */
public class ApiException extends RuntimeException {

    private final HttpStatus status;
    private final String code;

    private ApiException(HttpStatus status, String code, String message) {
        super(message);
        this.status = status;
        this.code = code;
    }

    public static ApiException invalid(String message) {
        return new ApiException(HttpStatus.BAD_REQUEST, "invalid", message);
    }

    public static ApiException forbidden(String message) {
        return new ApiException(HttpStatus.FORBIDDEN, "forbidden", message);
    }

    public static ApiException notFound(String message) {
        return new ApiException(HttpStatus.NOT_FOUND, "not_found", message);
    }

    public static ApiException conflict(String message) {
        return new ApiException(HttpStatus.CONFLICT, "conflict", message);
    }

    public static ApiException invalidCredentials(String message) {
        return new ApiException(HttpStatus.UNAUTHORIZED, "invalid_credentials", message);
    }

    public HttpStatus getStatus() { return status; }
    public String getCode() { return code; }
}
