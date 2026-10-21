package com.voyager.backend.calendar;

import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Base64;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import java.util.regex.Pattern;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.voyager.backend.activities.Idea;
import com.voyager.backend.activities.IdeaRepository;
import com.voyager.backend.calendar.IcsWriter.Event;
import com.voyager.backend.common.ApiException;
import com.voyager.backend.trip.Trip;
import com.voyager.backend.trip.TripMemberRepository;
import com.voyager.backend.trip.TripRepository;

// The trip calendar as a file, two ways: a download for the signed-in person, and a link a calendar
// app can subscribe to. Both are built the same way, from what is already stored. Nothing about the
// calendar itself is stored: it is the activities that are going ahead and have a start time, which
// is the same rule the frontend's calendar uses (lib/calendar.ts).
//
//   - Only people on the trip get either. For anyone else the trip does not exist (404).
//   - The subscription link carries a secret token. A token that is unknown, malformed, replaced, or
//     belongs to someone who has since left the trip is the same plain 404, so nothing is revealed
//     about which of those it was.
//   - Looking at the calendar changes nothing, so it takes no lock. Creating or replacing a link
//     takes the trip lock, like every other change on a trip, so two requests cannot both create one.

@Service
public class CalendarService {

    private static final String NO_SUCH_TRIP = "That trip does not exist.";
    private static final String NO_SUCH_FEED = "That calendar link does not exist.";

    // 32 random bytes, written URL-safe without padding: always 43 characters.
    private static final Pattern TOKEN = Pattern.compile("[A-Za-z0-9_-]{43}");
    private static final SecureRandom RANDOM = new SecureRandom();

    // A calendar ready to send: the trip's name (for the file name) and the file's text.
    public record Document(String tripName, String body) {}

    private final CalendarFeedRepository feeds;
    private final IdeaRepository ideas;
    private final TripRepository trips;
    private final TripMemberRepository members;

    public CalendarService(CalendarFeedRepository feeds, IdeaRepository ideas, TripRepository trips,
            TripMemberRepository members) {
        this.feeds = feeds;
        this.ideas = ideas;
        this.trips = trips;
        this.members = members;
    }

    private static Instant now() {
        return Instant.now().truncatedTo(ChronoUnit.MICROS);
    }

    private static String newToken() {
        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private static ApiException noSuchTrip() {
        return ApiException.notFound(NO_SUCH_TRIP);
    }

    private static ApiException noSuchFeed() {
        return ApiException.notFound(NO_SUCH_FEED);
    }

    private void lockTripAsMember(UUID tripId, UUID userId) {
        trips.findLockedById(tripId).orElseThrow(CalendarService::noSuchTrip);
        members.findByTripIdAndUserId(tripId, userId).orElseThrow(CalendarService::noSuchTrip);
    }

    /* The subscription link */

    // The person's link, made the first time it is asked for and the same one every time after.
    @Transactional
    public CalendarFeed feedFor(UUID tripId, UUID userId) {
        lockTripAsMember(tripId, userId);
        return feeds.findByTripIdAndUserId(tripId, userId)
                .orElseGet(() -> feeds.save(new CalendarFeed(tripId, userId, newToken(), now())));
    }

    // A new link. The old one stops working at once, which is the way to cut off a link that was
    // shared by mistake.
    @Transactional
    public CalendarFeed regenerate(UUID tripId, UUID userId) {
        lockTripAsMember(tripId, userId);
        CalendarFeed feed = feeds.findByTripIdAndUserId(tripId, userId)
                .orElseGet(() -> new CalendarFeed(tripId, userId, null, now()));
        feed.setToken(newToken());
        return feeds.save(feed);
    }

    // Called when someone leaves or is removed. The link would already be refused (it checks the
    // person is still on the trip), but there is no reason to keep it, and it must not come back to
    // life if they rejoin.
    @Transactional
    public void memberLeft(UUID tripId, UUID userId) {
        feeds.deleteByTripIdAndUserId(tripId, userId);
    }

    /* The calendar itself */

    // The signed-in person's download.
    @Transactional(readOnly = true)
    public Document download(UUID tripId, UUID userId) {
        members.findByTripIdAndUserId(tripId, userId).orElseThrow(CalendarService::noSuchTrip);
        return build(tripId, userId, CalendarService::noSuchTrip);
    }

    // What a calendar app fetches. userId is who the link belongs to, which is what later lets
    // personal bookings appear only in their owner's calendar.
    @Transactional(readOnly = true)
    public Document viaLink(String token) {
        if (token == null || !TOKEN.matcher(token).matches()) {
            throw noSuchFeed();
        }
        CalendarFeed feed = feeds.findByToken(token).orElseThrow(CalendarService::noSuchFeed);
        members.findByTripIdAndUserId(feed.getTripId(), feed.getUserId()).orElseThrow(CalendarService::noSuchFeed);
        return build(feed.getTripId(), feed.getUserId(), CalendarService::noSuchFeed);
    }

    private Document build(UUID tripId, UUID viewerId, java.util.function.Supplier<ApiException> missing) {
        Trip trip = trips.findById(tripId).orElseThrow(missing);
        List<Event> events = ideas.findByTripId(tripId).stream()
                .filter(idea -> idea.getStatus().onThePlan() && idea.getProposedStart() != null)
                .sorted(Comparator.comparing(Idea::getProposedStart).thenComparing(Idea::getId))
                .map(CalendarService::eventOf)
                .toList();
        return new Document(trip.getName(), IcsWriter.calendar(trip.getName(), events));
    }

    private static Event eventOf(Idea idea) {
        return new Event(
                "idea-" + idea.getId() + "@voyager",
                idea.getCreatedAt(),
                idea.getProposedStart(),
                idea.getProposedEnd(),
                idea.isAllDay(),
                idea.getTitle(),
                idea.getDescription(),
                idea.getCategory().name().toLowerCase(java.util.Locale.ROOT));
    }
}
