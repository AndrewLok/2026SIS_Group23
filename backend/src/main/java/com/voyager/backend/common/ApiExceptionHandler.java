package com.voyager.backend.common;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

// One place that decides what an error looks like on the wire, so every endpoint fails
// in the { code, message } shape the frontend's ApiError expects.

@RestControllerAdvice
public class ApiExceptionHandler {

    private static final Logger LOG = LoggerFactory.getLogger(ApiExceptionHandler.class);

    @ExceptionHandler(ApiException.class)
    public ResponseEntity<ErrorResponse> handleApi(ApiException e) {
        return ResponseEntity.status(e.status()).body(e.error());
    }

    // Malformed JSON, or a field of the wrong type.
    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ErrorResponse> handleUnreadable(HttpMessageNotReadableException e) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(ErrorResponse.invalid("That was not understood. Check it and try again."));
    }

    // An id in the URL that is not a UUID can never match anything, which is a 404 rather than a 400.
    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<ErrorResponse> handleBadPathValue(MethodArgumentTypeMismatchException e) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(ErrorResponse.notFound("That could not be found."));
    }

    // The last line of defence. The races we know about (sign-up with the same email twice, the first
    // "mark as read" from two devices) are dealt with where they happen, and over-long text is refused
    // before it reaches the database (see Limits), so getting here means something unexpected clashed.
    // Say so in the log, because the person only sees the vague message below.
    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<ErrorResponse> handleConflict(DataIntegrityViolationException e) {
        LOG.warn("A request hit a database constraint that nothing checked for", e);
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(ErrorResponse.conflict("That clashes with something that already exists."));
    }
}
