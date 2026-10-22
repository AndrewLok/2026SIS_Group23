package com.voyager.backend.bookings;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.voyager.backend.bookings.requestdto.CreateBookingRequest;
import com.voyager.backend.bookings.responsedto.BookingResponse;
import com.voyager.backend.security.CurrentUser;

// Every endpoint here needs a signed-in user (see SecurityConfig). The rules about who may do what
// are in BookingService; this class only translates HTTP to and from it.

@RestController
@RequestMapping("/api")
public class BookingController {

    private final BookingService service;

    public BookingController(BookingService service) {
        this.service = service;
    }

    @GetMapping("/trips/{tripId}/bookings")
    public ResponseEntity<List<BookingResponse>> list(@PathVariable UUID tripId, Authentication authentication) {
        List<BookingResponse> body = service.list(tripId, CurrentUser.id(authentication)).stream()
                .map(BookingResponse::from)
                .toList();
        return ResponseEntity.ok(body);
    }

    @PostMapping("/trips/{tripId}/bookings")
    public ResponseEntity<BookingResponse> create(@PathVariable UUID tripId, @RequestBody CreateBookingRequest request,
            Authentication authentication) {
        var created = service.create(tripId, CurrentUser.id(authentication), request);
        return ResponseEntity.status(HttpStatus.CREATED).body(BookingResponse.from(created));
    }

    // Partial update: send only the fields to change. See BookingService.update.
    @PatchMapping("/bookings/{bookingId}")
    public ResponseEntity<BookingResponse> update(@PathVariable UUID bookingId, @RequestBody Map<String, Object> patch,
            Authentication authentication) {
        return ResponseEntity.ok(BookingResponse.from(service.update(bookingId, CurrentUser.id(authentication), patch)));
    }

    @DeleteMapping("/bookings/{bookingId}")
    public ResponseEntity<Void> remove(@PathVariable UUID bookingId, Authentication authentication) {
        service.remove(bookingId, CurrentUser.id(authentication));
        return ResponseEntity.noContent().build();
    }
}
