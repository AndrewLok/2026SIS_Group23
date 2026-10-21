package com.voyager.backend.booking;

import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Set;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.voyager.backend.booking.requestDTO.CreateBookingRequest;
import com.voyager.backend.booking.responseDTO.BookingResponse;
import com.voyager.backend.common.ApiException;
import com.voyager.backend.common.Patch;
import com.voyager.backend.common.Times;
import com.voyager.backend.trip.TripAccess;

/** Mirrors the front end's services/mock/bookings.ts. */
@Service
public class BookingService {

    private static final Set<String> TYPES = Set.of("flight", "stay", "car", "other");
    private static final String BAD_TIME = "Pick a valid date and time.";

    private final BookingRepository bookingRepository;
    private final TripAccess access;

    public BookingService(BookingRepository bookingRepository, TripAccess access) {
        this.bookingRepository = bookingRepository;
        this.access = access;
    }

    /** Soonest first; undated bookings lead, as they do in the mock. */
    @Transactional(readOnly = true)
    public List<BookingResponse> list(String callerId, String tripId) {
        access.requireMember(tripId, callerId);
        return bookingRepository.findByTripId(tripId).stream()
                .sorted(Comparator.comparing(Booking::getStartsAt, Comparator.nullsFirst(Comparator.<Instant>naturalOrder())))
                .map(BookingResponse::from)
                .toList();
    }

    @Transactional
    public BookingResponse create(String callerId, String tripId, CreateBookingRequest req) {
        access.requireMember(tripId, callerId);
        String title = trim(req.title());
        if (title.isEmpty()) throw ApiException.invalid("Give the booking a title.");
        Booking booking = new Booking(null, tripId, checkType(req.type()), title, trim(req.provider()),
                trim(req.reference()), Times.parse(req.startsAt(), BAD_TIME), Times.parse(req.endsAt(), BAD_TIME),
                trim(req.origin()), trim(req.destination()), checkCost(req.costCents()), req.belongsTo(),
                trim(req.notes()));
        return BookingResponse.from(bookingRepository.save(booking));
    }

    @Transactional
    public BookingResponse update(String callerId, String bookingId, Patch patch) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> ApiException.notFound("That booking has been deleted."));
        access.requireMember(booking.getTripId(), callerId);
        if (patch.has("type")) booking.setType(checkType(patch.string("type")));
        if (patch.has("title")) {
            String title = trim(patch.string("title"));
            if (title.isEmpty()) throw ApiException.invalid("Give the booking a title.");
            booking.setTitle(title);
        }
        if (patch.has("provider")) booking.setProvider(trim(patch.string("provider")));
        if (patch.has("reference")) booking.setReference(trim(patch.string("reference")));
        if (patch.has("startsAt")) booking.setStartsAt(Times.parse(patch.string("startsAt"), BAD_TIME));
        if (patch.has("endsAt")) booking.setEndsAt(Times.parse(patch.string("endsAt"), BAD_TIME));
        if (patch.has("origin")) booking.setOrigin(trim(patch.string("origin")));
        if (patch.has("destination")) booking.setDestination(trim(patch.string("destination")));
        if (patch.has("costCents")) booking.setCostCents(checkCost(patch.longValue("costCents")));
        if (patch.has("belongsTo")) booking.setBelongsTo(patch.string("belongsTo"));
        if (patch.has("notes")) booking.setNotes(trim(patch.string("notes")));
        return BookingResponse.from(booking);
    }

    @Transactional
    public void remove(String callerId, String bookingId) {
        Booking booking = bookingRepository.findById(bookingId).orElse(null);
        if (booking == null) return; // Already gone, which is what was asked for.
        access.requireMember(booking.getTripId(), callerId);
        bookingRepository.delete(booking);
    }

    private static String checkType(String type) {
        if (type == null || !TYPES.contains(type)) throw ApiException.invalid("Pick what kind of booking it is.");
        return type;
    }

    private static Long checkCost(Long cents) {
        if (cents != null && cents < 0) throw ApiException.invalid("Enter a cost of zero or more.");
        return cents;
    }

    private static String trim(String value) {
        return value == null ? "" : value.trim();
    }
}
