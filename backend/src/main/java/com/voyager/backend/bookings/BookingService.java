package com.voyager.backend.bookings;

import java.time.Instant;
import java.time.format.DateTimeParseException;
import java.time.temporal.ChronoUnit;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.voyager.backend.bookings.requestdto.CreateBookingRequest;
import com.voyager.backend.common.ApiException;
import com.voyager.backend.common.Limits;
import com.voyager.backend.trip.Role;
import com.voyager.backend.trip.TripMember;
import com.voyager.backend.trip.TripMemberRepository;
import com.voyager.backend.trip.TripRepository;

// The rules for bookings.
//
//   - Only people on a trip can see its bookings or add to them. For anyone else they do not exist
//     (404), the same way a trip you are not on does not exist.
//   - Everyone on the trip sees every booking, including the ones that belong to one person; those
//     are marked as theirs, not hidden. (The frontend's cost estimate counts them all, and hiding
//     some would give each person a different total.)
//   - A booking belongs to the whole group or to one person on the trip.
//   - Whoever added a booking, the person it belongs to, or the trip's owner, can change or delete
//     it. Nobody else can.
//   - A booking that belongs to someone who leaves the trip goes with them. One they added for the
//     group, or for somebody else, stays.
//
// Everything that changes anything first locks the trip's row, like activities do. There are no
// counts to protect here, but it is what stops a booking being made for somebody at the moment they
// leave, which would leave one belonging to a person who is no longer on the trip.

@Service
public class BookingService {

    private static final String NO_SUCH_TRIP = "That trip does not exist.";
    private static final String NO_SUCH_BOOKING = "That booking has been deleted.";
    private static final String NOT_YOURS_TO_CHANGE =
            "Only the person who added this, the person it is for, or the trip owner, can change it.";
    private static final String NOT_YOURS_TO_DELETE =
            "Only the person who added this, the person it is for, or the trip owner, can delete it.";

    private record Locked(Booking booking, TripMember me) {}

    private final BookingRepository bookings;
    private final TripRepository trips;
    private final TripMemberRepository members;

    public BookingService(BookingRepository bookings, TripRepository trips, TripMemberRepository members) {
        this.bookings = bookings;
        this.trips = trips;
        this.members = members;
    }

    // Stored times are kept to the microsecond, which is what the database holds.
    private static Instant now() {
        return Instant.now().truncatedTo(ChronoUnit.MICROS);
    }

    /* Looking things up */

    private static ApiException noSuchTrip() {
        return ApiException.notFound(NO_SUCH_TRIP);
    }

    private static ApiException noSuchBooking() {
        return ApiException.notFound(NO_SUCH_BOOKING);
    }

    private TripMember requireMember(UUID tripId, UUID userId) {
        return members.findByTripIdAndUserId(tripId, userId).orElseThrow(BookingService::noSuchTrip);
    }

    // Takes the trip's lock and then checks the person is on it. Must come before any other read.
    private TripMember lockTripAsMember(UUID tripId, UUID userId) {
        trips.findLockedById(tripId).orElseThrow(BookingService::noSuchTrip);
        return requireMember(tripId, userId);
    }

    // The same for an existing booking, which is first looked at only for the trip it belongs to.
    private Locked lockBooking(UUID bookingId, UUID userId) {
        UUID tripId = bookings.findTripIdById(bookingId).orElseThrow(BookingService::noSuchBooking);
        trips.findLockedById(tripId).orElseThrow(BookingService::noSuchBooking);
        TripMember me = members.findByTripIdAndUserId(tripId, userId).orElseThrow(BookingService::noSuchBooking);
        Booking booking = bookings.findById(bookingId).orElseThrow(BookingService::noSuchBooking);
        return new Locked(booking, me);
    }

    private static void requireAllowed(Booking booking, TripMember me, String message) {
        boolean mine = booking.getCreatedBy().equals(me.getUserId()) || me.getUserId().equals(booking.getBelongsTo());
        if (!mine && me.getRole() != Role.OWNER) {
            throw ApiException.forbidden(message);
        }
    }

    /* Reading */

    // In time order, the ones with no time last.
    @Transactional(readOnly = true)
    public List<Booking> list(UUID tripId, UUID userId) {
        requireMember(tripId, userId);
        return bookings.findByTripId(tripId).stream()
                .sorted(Comparator.comparing(Booking::getStartsAt, Comparator.nullsLast(Comparator.naturalOrder()))
                        .thenComparing(Booking::getCreatedAt)
                        .thenComparing(Booking::getId))
                .toList();
    }

    /* Changing */

    @Transactional
    public Booking create(UUID tripId, UUID userId, CreateBookingRequest request) {
        lockTripAsMember(tripId, userId);

        BookingType type = typeOf(request.type());
        String title = titleOf(request.title() == null ? "" : request.title());
        String provider = bounded(request.provider(), "provider", Limits.BOOKING_PROVIDER);
        String reference = bounded(request.reference(), "reference", Limits.BOOKING_REFERENCE);
        Instant starts = instantOrNull(request.startsAt(), "startsAt");
        Instant ends = instantOrNull(request.endsAt(), "endsAt");
        checkTimes(starts, ends);
        String origin = bounded(request.origin(), "place", Limits.BOOKING_PLACE);
        String destination = bounded(request.destination(), "place", Limits.BOOKING_PLACE);
        Long cost = request.costCents() == null ? null : checkedCost(request.costCents());
        UUID belongsTo = personOnTheTrip(tripId, uuidOrNull(request.belongsTo()));
        String notes = bounded(request.notes(), "notes", Limits.BOOKING_NOTES);

        return bookings.save(new Booking(tripId, type, title, provider, reference, starts, ends, origin,
                destination, cost, belongsTo, notes, userId, now()));
    }

    // A partial update. The body is a plain map so that "leave it alone" and "clear it" can be told
    // apart for the times, the cost and the owner. Keys that are not listed here (id, tripId,
    // createdBy, ...) are ignored.
    @Transactional
    public Booking update(UUID bookingId, UUID userId, Map<String, Object> patch) {
        Locked locked = lockBooking(bookingId, userId);
        Booking booking = locked.booking();
        requireAllowed(booking, locked.me(), NOT_YOURS_TO_CHANGE);

        if (patch.containsKey("type")) {
            booking.setType(typeOf(text(patch.get("type"), "type")));
        }
        if (patch.containsKey("title")) {
            booking.setTitle(titleOf(text(patch.get("title"), "title")));
        }
        if (patch.containsKey("provider")) {
            booking.setProvider(bounded(text(patch.get("provider"), "provider"), "provider", Limits.BOOKING_PROVIDER));
        }
        if (patch.containsKey("reference")) {
            booking.setReference(bounded(text(patch.get("reference"), "reference"), "reference", Limits.BOOKING_REFERENCE));
        }
        if (patch.containsKey("startsAt")) {
            booking.setStartsAt(instantOrNull(patch.get("startsAt"), "startsAt"));
        }
        if (patch.containsKey("endsAt")) {
            booking.setEndsAt(instantOrNull(patch.get("endsAt"), "endsAt"));
        }
        checkTimes(booking.getStartsAt(), booking.getEndsAt());
        if (patch.containsKey("origin")) {
            booking.setOrigin(bounded(text(patch.get("origin"), "origin"), "place", Limits.BOOKING_PLACE));
        }
        if (patch.containsKey("destination")) {
            booking.setDestination(bounded(text(patch.get("destination"), "destination"), "place", Limits.BOOKING_PLACE));
        }
        if (patch.containsKey("costCents")) {
            Object value = patch.get("costCents");
            booking.setCostCents(value == null ? null : checkedCost(wholeNumber(value, "costCents")));
        }
        if (patch.containsKey("belongsTo")) {
            Object value = patch.get("belongsTo");
            if (value != null && !(value instanceof String)) {
                throw ApiException.invalid("belongsTo has to be a person's id, or empty for the whole group.");
            }
            booking.setBelongsTo(personOnTheTrip(booking.getTripId(), uuidOrNull((String) value)));
        }
        if (patch.containsKey("notes")) {
            booking.setNotes(bounded(text(patch.get("notes"), "notes"), "notes", Limits.BOOKING_NOTES));
        }
        return bookings.save(booking);
    }

    @Transactional
    public void remove(UUID bookingId, UUID userId) {
        Locked locked = lockBooking(bookingId, userId);
        requireAllowed(locked.booking(), locked.me(), NOT_YOURS_TO_DELETE);
        bookings.delete(locked.booking());
    }

    /* Leaving */

    // Called by TripService, inside the transaction that removes the person (so the trip is already
    // locked). What belonged to them goes with them.
    @Transactional
    public void memberLeft(UUID tripId, UUID leaverId) {
        for (Booking booking : bookings.findByTripId(tripId)) {
            if (leaverId.equals(booking.getBelongsTo())) {
                bookings.delete(booking);
            }
        }
    }

    /* Checking what was sent */

    private static BookingType typeOf(String wire) {
        BookingType type = BookingType.fromWire(wire);
        if (type == null) {
            throw ApiException.invalid("Pick a type: flight, stay, car or other.");
        }
        return type;
    }

    private static String titleOf(String raw) {
        String title = raw.trim();
        if (title.isEmpty()) {
            throw ApiException.invalid("Give the booking a title.");
        }
        if (title.length() > Limits.BOOKING_TITLE) {
            throw ApiException.invalid(Limits.tooLong("title", Limits.BOOKING_TITLE));
        }
        return title;
    }

    // Optional text: missing is empty, and it is trimmed and kept to its limit.
    private static String bounded(String raw, String what, int max) {
        String value = raw == null ? "" : raw.trim();
        if (value.length() > max) {
            throw ApiException.invalid(Limits.tooLong(what, max));
        }
        return value;
    }

    private static void checkTimes(Instant start, Instant end) {
        if (end != null && start == null) {
            throw ApiException.invalid("Add a start time before an end time.");
        }
        if (end != null && end.isBefore(start)) {
            throw ApiException.invalid("It cannot end before it starts.");
        }
    }

    private static long checkedCost(long cents) {
        if (cents < 0) {
            throw ApiException.invalid("The cost cannot be negative.");
        }
        if (cents > Limits.MAX_BOOKING_COST_CENTS) {
            throw ApiException.invalid("That cost is too large.");
        }
        return cents;
    }

    private static UUID uuidOrNull(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            return UUID.fromString(raw.trim());
        } catch (IllegalArgumentException e) {
            throw ApiException.invalid("That person is not on this trip.");
        }
    }

    // Null (the whole group) is always fine; anyone else has to be on the trip right now.
    private UUID personOnTheTrip(UUID tripId, UUID personId) {
        if (personId != null && members.findByTripIdAndUserId(tripId, personId).isEmpty()) {
            throw ApiException.invalid("That person is not on this trip.");
        }
        return personId;
    }

    private static String text(Object value, String field) {
        if (value instanceof String string) {
            return string;
        }
        throw ApiException.invalid(field + " has to be text.");
    }

    private static long wholeNumber(Object value, String field) {
        if (value instanceof Integer || value instanceof Long || value instanceof Short || value instanceof Byte) {
            return ((Number) value).longValue();
        }
        if (value instanceof Double || value instanceof Float) {
            double d = ((Number) value).doubleValue();
            if (!Double.isNaN(d) && !Double.isInfinite(d) && d == Math.rint(d) && Math.abs(d) < 9e15) {
                return (long) d;
            }
        }
        throw ApiException.invalid(field + " has to be a whole number.");
    }

    private static Instant instantOrNull(Object value, String field) {
        if (value == null) {
            return null;
        }
        if (value instanceof String string) {
            if (string.isBlank()) {
                return null;
            }
            try {
                return Instant.parse(string.trim()).truncatedTo(ChronoUnit.MICROS);
            } catch (DateTimeParseException e) {
                throw ApiException.invalid(field + " has to be a date and time like 2026-11-08T00:00:00Z.");
            }
        }
        throw ApiException.invalid(field + " has to be a date and time like 2026-11-08T00:00:00Z.");
    }
}
