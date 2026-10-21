package com.voyager.backend.calendar;

import java.util.UUID;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.voyager.backend.calendar.CalendarService.Document;
import com.voyager.backend.calendar.responsedto.FeedResponse;
import com.voyager.backend.security.CurrentUser;

// The first three endpoints need a signed-in user (see SecurityConfig). The last is the one a
// calendar app calls, so it is open to anyone who holds the token in its address, and only for GET.
// The rules are in CalendarService; this class only translates HTTP to and from it.

@RestController
@RequestMapping("/api")
public class CalendarController {

    private static final String CALENDAR_TYPE = "text/calendar;charset=UTF-8";

    private final CalendarService service;

    public CalendarController(CalendarService service) {
        this.service = service;
    }

    // The signed-in person's subscription link, made on first use.
    @GetMapping("/trips/{tripId}/calendar/feed")
    public ResponseEntity<FeedResponse> feed(@PathVariable UUID tripId, Authentication authentication) {
        return ResponseEntity.ok(FeedResponse.from(service.feedFor(tripId, CurrentUser.id(authentication))));
    }

    // A new link; the old one stops working.
    @PostMapping("/trips/{tripId}/calendar/feed")
    public ResponseEntity<FeedResponse> regenerate(@PathVariable UUID tripId, Authentication authentication) {
        return ResponseEntity.ok(FeedResponse.from(service.regenerate(tripId, CurrentUser.id(authentication))));
    }

    // A one-off copy of the calendar, to import.
    @GetMapping("/trips/{tripId}/calendar.ics")
    public ResponseEntity<String> download(@PathVariable UUID tripId, Authentication authentication) {
        Document document = service.download(tripId, CurrentUser.id(authentication));
        return ResponseEntity.ok()
                .header("Content-Type", CALENDAR_TYPE)
                .header("Content-Disposition", "attachment; filename=\"" + fileName(document.tripName()) + ".ics\"")
                .header("Cache-Control", "no-store")
                .body(document.body());
    }

    // What a calendar app fetches. No login: the token is the key.
    // The class is mapped under /api, so this is FeedResponse.PREFIX + token + FeedResponse.SUFFIX without
    // the /api. (CalendarFlowTests fails if the two ever drift apart.)
    @GetMapping("/calendar/feeds/{token}.ics")
    public ResponseEntity<String> viaLink(@PathVariable String token) {
        Document document = service.viaLink(token);
        return ResponseEntity.ok()
                .header("Content-Type", CALENDAR_TYPE)
                .header("Cache-Control", "private, max-age=300")
                .header("Referrer-Policy", "no-referrer")
                .body(document.body());
    }

    // A file name that is safe in a header whatever the trip is called: letters, digits and hyphens.
    static String fileName(String tripName) {
        String slug = tripName.toLowerCase(java.util.Locale.ROOT)
                .replaceAll("[^a-z0-9]+", "-")
                .replaceAll("^-+|-+$", "");
        return slug.isEmpty() ? "voyager-trip" : "voyager-" + slug;
    }
}
