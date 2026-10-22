package com.voyager.backend.trip;

import java.security.SecureRandom;
import java.time.Instant;
import java.time.format.DateTimeParseException;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.voyager.backend.activities.IdeaService;
import com.voyager.backend.bookings.BookingService;
import com.voyager.backend.calendar.CalendarService;
import com.voyager.backend.chat.ChatService;
import com.voyager.backend.common.ApiException;
import com.voyager.backend.common.Limits;
import com.voyager.backend.trip.requestdto.CreateTripRequest;
import com.voyager.backend.user.User;
import com.voyager.backend.user.UserRepository;

// Everything about who may do what on a trip lives here, so the controller only translates HTTP.
//
// The rules, in one place:
//   - You can only see or touch a trip you are on. For anyone else it simply does not exist (404).
//   - Owners change the trip's name, place, dates and currency, regenerate the invite code,
//     remove other people and change roles.
//   - Any member can change the shared settings (privateDebts, allowance, fuel defaults), because
//     the frontend lets everyone flip those, and can leave on their own.
//   - A trip always keeps at least one owner.
//   - Leaving (or being removed) also takes the person's votes and "going" off the trip's activities.
//
// Methods that change data are transactional, so a rejected request leaves nothing half done.
// Anything that changes who is on a trip first locks the trip's row (lockTrip), so two requests at
// the same moment cannot both look at "two owners" and each remove one of them.

@Service
public class TripService {

    // Six uppercase characters, leaving out the glyphs people misread aloud (0/O, 1/I).
    // This matches the alphabet the frontend uses for invite codes.
    private static final String INVITE_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private static final int INVITE_CODE_LENGTH = 6;
    private static final SecureRandom RANDOM = new SecureRandom();

    // Fields only an owner may change through a PATCH. Everything else patchable is open to any member.
    private static final Set<String> OWNER_ONLY_FIELDS =
            Set.of("name", "destination", "startDate", "endDate", "currency", "budgetCapCents");

    private static final String NO_OWNER_MESSAGE = "A trip needs an owner. Hand it over before you leave.";

    // A member together with the person behind them, for responses that show both.
    public record MemberDetail(TripMember member, User user) {}

    private final TripRepository tripRepository;
    private final TripMemberRepository memberRepository;
    private final UserRepository userRepository;
    private final ChatService chatService;
    private final IdeaService ideaService;
    private final CalendarService calendarService;
    private final BookingService bookingService;

    public TripService(TripRepository tripRepository, TripMemberRepository memberRepository, UserRepository userRepository,
            ChatService chatService, IdeaService ideaService, CalendarService calendarService,
            BookingService bookingService) {
        this.tripRepository = tripRepository;
        this.memberRepository = memberRepository;
        this.userRepository = userRepository;
        this.chatService = chatService;
        this.ideaService = ideaService;
        this.calendarService = calendarService;
        this.bookingService = bookingService;
    }

    /* Looking things up */

    private Trip requireTrip(UUID tripId) {
        return tripRepository.findById(tripId)
                .orElseThrow(() -> ApiException.notFound("That trip does not exist."));
    }

    // A trip you are not on looks exactly like a trip that is not there.
    private TripMember requireMember(UUID tripId, UUID userId) {
        return memberRepository.findByTripIdAndUserId(tripId, userId)
                .orElseThrow(() -> ApiException.notFound("That trip does not exist."));
    }

    private TripMember requireOwner(UUID tripId, UUID userId, String message) {
        TripMember member = requireMember(tripId, userId);
        if (member.getRole() != Role.OWNER) {
            throw ApiException.forbidden(message);
        }
        return member;
    }

    // Waits for any other change to this trip's membership to finish, then holds the trip until this
    // transaction ends. Must be the first thing such a method does, so everything it reads afterwards is current.
    private Trip lockTrip(UUID tripId) {
        return tripRepository.findLockedById(tripId)
                .orElseThrow(() -> ApiException.notFound("That trip does not exist."));
    }

    private static String normaliseCode(String code) {
        return code == null ? "" : code.trim().toUpperCase(Locale.ROOT);
    }

    private String generateInviteCode() {
        String code;
        do {
            StringBuilder sb = new StringBuilder(INVITE_CODE_LENGTH);
            for (int i = 0; i < INVITE_CODE_LENGTH; i++) {
                sb.append(INVITE_CODE_ALPHABET.charAt(RANDOM.nextInt(INVITE_CODE_ALPHABET.length())));
            }
            code = sb.toString();
        } while (tripRepository.existsByInviteCode(code));
        return code;
    }

    private List<MemberDetail> detailsFor(List<TripMember> members) {
        Map<UUID, User> users = new HashMap<>();
        userRepository.findAllById(members.stream().map(TripMember::getUserId).toList())
                .forEach(user -> users.put(user.getId(), user));

        return members.stream()
                .sorted(Comparator.comparing(TripMember::getJoinedAt))
                .filter(member -> users.containsKey(member.getUserId()))
                .map(member -> new MemberDetail(member, users.get(member.getUserId())))
                .toList();
    }

    private static String checkedName(String name) {
        if (name.length() > Limits.TRIP_NAME) {
            throw ApiException.invalid(Limits.tooLong("name", Limits.TRIP_NAME));
        }
        return name;
    }

    private static String checkedDestination(String destination) {
        if (destination.length() > Limits.DESTINATION) {
            throw ApiException.invalid(Limits.tooLong("destination", Limits.DESTINATION));
        }
        return destination;
    }

    private static void checkDates(Instant start, Instant end) {
        if (start != null && end != null && end.isBefore(start)) {
            throw ApiException.invalid("The trip cannot end before it starts.");
        }
    }

    /* Trips */

    // Only the trips this person is on.
    @Transactional(readOnly = true)
    public List<Trip> listFor(UUID userId) {
        List<UUID> tripIds = memberRepository.findByUserId(userId).stream().map(TripMember::getTripId).toList();
        return tripRepository.findAllById(tripIds);
    }

    @Transactional(readOnly = true)
    public Trip get(UUID tripId, UUID userId) {
        requireMember(tripId, userId);
        return requireTrip(tripId);
    }

    // The person who makes a trip is its first member and its owner, and the trip starts with a
    // "general" chat channel.
    @Transactional
    public Trip create(UUID userId, CreateTripRequest request) {
        if (request.name() == null || request.name().isBlank()) {
            throw ApiException.invalid("Give the trip a name.");
        }
        String name = checkedName(request.name().trim());
        String destination = checkedDestination(request.destination() == null ? "" : request.destination().trim());
        checkDates(request.startDate(), request.endDate());
        if (request.budgetCapCents() != null && request.budgetCapCents() < 0) {
            throw ApiException.invalid("The budget cannot be negative.");
        }

        Trip trip = tripRepository.save(new Trip(
                name,
                destination,
                request.startDate(),
                request.endDate(),
                request.budgetCapCents(),
                generateInviteCode(),
                userId,
                ThreadLocalRandom.current().nextInt(360)
        ));
        memberRepository.save(new TripMember(trip.getId(), userId, Role.OWNER, Instant.now()));
        chatService.createGeneral(trip.getId());
        return trip;
    }

    // A partial update. The body is a plain map rather than a record because "leave it alone" and
    // "set it to nothing" are different things for dates and the budget, and only a map can tell
    // a missing key from a null one. Keys that are not listed here (id, inviteCode, ...) are ignored.
    @Transactional
    public Trip update(UUID tripId, UUID userId, Map<String, Object> patch) {
        TripMember me = requireMember(tripId, userId);
        Trip trip = requireTrip(tripId);

        if (me.getRole() != Role.OWNER && patch.keySet().stream().anyMatch(OWNER_ONLY_FIELDS::contains)) {
            throw ApiException.forbidden("Only the trip owner can change that.");
        }

        if (patch.containsKey("name")) {
            String name = text(patch.get("name"), "name").trim();
            if (name.isEmpty()) {
                throw ApiException.invalid("Give the trip a name.");
            }
            trip.setName(checkedName(name));
        }
        if (patch.containsKey("destination")) {
            trip.setDestination(checkedDestination(text(patch.get("destination"), "destination").trim()));
        }
        if (patch.containsKey("startDate")) {
            trip.setStartDate(instantOrNull(patch.get("startDate"), "startDate"));
        }
        if (patch.containsKey("endDate")) {
            trip.setEndDate(instantOrNull(patch.get("endDate"), "endDate"));
        }
        checkDates(trip.getStartDate(), trip.getEndDate());

        if (patch.containsKey("currency")) {
            String currency = text(patch.get("currency"), "currency").trim().toUpperCase(Locale.ROOT);
            if (!currency.matches("[A-Z]{3}")) {
                throw ApiException.invalid("Use a three-letter currency code, like AUD.");
            }
            trip.setCurrency(currency);
        }
        if (patch.containsKey("budgetCapCents")) {
            Object value = patch.get("budgetCapCents");
            if (value == null) {
                trip.setBudgetCapCents(null);
            } else {
                trip.setBudgetCapCents(wholeNumber(value, "budgetCapCents", 0, Long.MAX_VALUE / 2));
            }
        }
        if (patch.containsKey("allowanceCents")) {
            trip.setAllowanceCents(wholeNumber(patch.get("allowanceCents"), "allowanceCents", 0, Long.MAX_VALUE / 2));
        }
        if (patch.containsKey("defaultEfficiency")) {
            double efficiency = decimal(patch.get("defaultEfficiency"), "defaultEfficiency");
            if (efficiency <= 0 || efficiency > 100) {
                throw ApiException.invalid("Fuel use has to be above 0 and no more than 100 L/100km.");
            }
            trip.setDefaultEfficiency(efficiency);
        }
        if (patch.containsKey("defaultPricePerLitreCents")) {
            trip.setDefaultPricePerLitreCents(
                    (int) wholeNumber(patch.get("defaultPricePerLitreCents"), "defaultPricePerLitreCents", 0, 100_000));
        }
        if (patch.containsKey("privateDebts")) {
            if (!(patch.get("privateDebts") instanceof Boolean privateDebts)) {
                throw ApiException.invalid("privateDebts has to be true or false.");
            }
            trip.setPrivateDebts(privateDebts);
        }

        return tripRepository.save(trip);
    }

    /* Patch value parsing. Each one says which field was wrong, so the message can be shown as it is. */

    private static String text(Object value, String field) {
        if (value instanceof String string) {
            return string;
        }
        throw ApiException.invalid(field + " has to be text.");
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
                return Instant.parse(string.trim());
            } catch (DateTimeParseException e) {
                throw ApiException.invalid(field + " has to be a date and time like 2026-11-08T00:00:00Z.");
            }
        }
        throw ApiException.invalid(field + " has to be a date and time like 2026-11-08T00:00:00Z.");
    }

    // Whole numbers only: 12.5 cents is not a thing, and a float must never creep into money.
    private static long wholeNumber(Object value, String field, long min, long max) {
        long result;
        if (value instanceof Integer || value instanceof Long || value instanceof Short || value instanceof Byte) {
            result = ((Number) value).longValue();
        } else if (value instanceof Double || value instanceof Float) {
            double d = ((Number) value).doubleValue();
            if (Double.isNaN(d) || Double.isInfinite(d) || d != Math.rint(d)) {
                throw ApiException.invalid(field + " has to be a whole number.");
            }
            result = (long) d;
        } else {
            throw ApiException.invalid(field + " has to be a whole number.");
        }
        if (result < min || result > max) {
            throw ApiException.invalid(field + " is out of range.");
        }
        return result;
    }

    private static double decimal(Object value, String field) {
        if (value instanceof Number number) {
            double d = number.doubleValue();
            if (!Double.isNaN(d) && !Double.isInfinite(d)) {
                return d;
            }
        }
        throw ApiException.invalid(field + " has to be a number.");
    }

    /* Invite codes and joining */

    // Look at a trip by its code without joining it. Gives only what the join screen needs.
    @Transactional(readOnly = true)
    public MemberPreview preview(String code) {
        Trip trip = tripRepository.findByInviteCode(normaliseCode(code))
                .orElseThrow(() -> ApiException.notFound("That invite code does not match a trip."));
        return new MemberPreview(trip, detailsFor(memberRepository.findByTripId(trip.getId())));
    }

    public record MemberPreview(Trip trip, List<MemberDetail> members) {}

    // Joining twice is fine: the second time just returns the trip. Two taps at the same moment are
    // too, because the trip is locked while the first one is let in, so the second one finds them there.
    @Transactional
    public Trip join(String code, UUID userId) {
        UUID tripId = tripRepository.findByInviteCode(normaliseCode(code))
                .orElseThrow(() -> ApiException.notFound("That invite code does not match a trip."))
                .getId();
        Trip trip = lockTrip(tripId);
        if (memberRepository.findByTripIdAndUserId(trip.getId(), userId).isEmpty()) {
            memberRepository.save(new TripMember(trip.getId(), userId, Role.MEMBER, Instant.now()));
        }
        return trip;
    }

    @Transactional
    public Trip regenerateCode(UUID tripId, UUID userId) {
        requireOwner(tripId, userId, "Only the trip owner can make a new code.");
        Trip trip = requireTrip(tripId);
        trip.setInviteCode(generateInviteCode());
        return tripRepository.save(trip);
    }

    /* Members */

    @Transactional(readOnly = true)
    public List<MemberDetail> members(UUID tripId, UUID userId) {
        requireMember(tripId, userId);
        return detailsFor(memberRepository.findByTripId(tripId));
    }

    // Owners can remove anyone, and anyone can remove themselves (leave).
    @Transactional
    public void removeMember(UUID tripId, UUID actorId, UUID targetId) {
        lockTrip(tripId);
        TripMember actor = requireMember(tripId, actorId);
        TripMember target = memberRepository.findByTripIdAndUserId(tripId, targetId)
                .orElseThrow(() -> ApiException.notFound("That member is not on this trip."));

        if (!actorId.equals(targetId) && actor.getRole() != Role.OWNER) {
            throw ApiException.forbidden("Only the trip owner can remove people.");
        }
        if (target.getRole() == Role.OWNER && memberRepository.countByTripIdAndRole(tripId, Role.OWNER) <= 1) {
            throw ApiException.forbidden(NO_OWNER_MESSAGE);
        }
        memberRepository.delete(target);
        // Their votes and "going" leave with them, and what is still being decided is counted again
        // against the smaller group. The flush makes the head count it uses already exclude them.
        memberRepository.flush();
        ideaService.memberLeft(tripId, targetId);
        bookingService.memberLeft(tripId, targetId);
        calendarService.memberLeft(tripId, targetId);
    }

    @Transactional
    public void updateRole(UUID tripId, UUID actorId, UUID targetId, Role role) {
        lockTrip(tripId);
        requireOwner(tripId, actorId, "Only the trip owner can change roles.");
        TripMember target = memberRepository.findByTripIdAndUserId(tripId, targetId)
                .orElseThrow(() -> ApiException.notFound("That member is not on this trip."));

        if (target.getRole() == Role.OWNER && role != Role.OWNER
                && memberRepository.countByTripIdAndRole(tripId, Role.OWNER) <= 1) {
            throw ApiException.forbidden(NO_OWNER_MESSAGE);
        }
        target.setRole(role);
        memberRepository.save(target);
    }
}
