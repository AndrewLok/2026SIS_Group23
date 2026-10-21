package com.voyager.backend.booking;

import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.voyager.backend.booking.requestDTO.CreateBookingRequest;
import com.voyager.backend.booking.responseDTO.BookingResponse;
import com.voyager.backend.common.Patch;
import com.voyager.backend.common.Session;

import jakarta.servlet.http.HttpSession;

@RestController
@RequestMapping("/api")
public class BookingController {

    private final BookingService bookingService;

    public BookingController(BookingService bookingService) {
        this.bookingService = bookingService;
    }

    @GetMapping("/trips/{tripId}/bookings")
    public List<BookingResponse> list(HttpSession session, @PathVariable String tripId) {
        return bookingService.list(Session.require(session), tripId);
    }

    @PostMapping("/trips/{tripId}/bookings")
    public ResponseEntity<BookingResponse> create(HttpSession session, @PathVariable String tripId,
                                                  @RequestBody CreateBookingRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(bookingService.create(Session.require(session), tripId, request));
    }

    @PatchMapping("/bookings/{bookingId}")
    public BookingResponse update(HttpSession session, @PathVariable String bookingId,
                                  @RequestBody Map<String, Object> patch) {
        return bookingService.update(Session.require(session), bookingId, new Patch(patch));
    }

    @DeleteMapping("/bookings/{bookingId}")
    public ResponseEntity<Void> remove(HttpSession session, @PathVariable String bookingId) {
        bookingService.remove(Session.require(session), bookingId);
        return ResponseEntity.noContent().build();
    }
}
