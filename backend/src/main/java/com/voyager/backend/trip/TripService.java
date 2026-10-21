package com.voyager.backend.trip;

import java.security.SecureRandom;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.voyager.backend.chat.Channel;
import com.voyager.backend.chat.ChannelRepository;
import com.voyager.backend.common.ApiException;
import com.voyager.backend.common.Patch;
import com.voyager.backend.common.Times;
import com.voyager.backend.trip.requestDTO.CreateTripRequest;
import com.voyager.backend.trip.responseDTO.MemberResponse;
import com.voyager.backend.trip.responseDTO.TripPreviewResponse;
import com.voyager.backend.trip.responseDTO.TripResponse;
import com.voyager.backend.user.User;
import com.voyager.backend.user.UserRepository;
import com.voyager.backend.user.responseDTO.ProfileResponse;

/** Trips, invites and membership. Mirrors the front end's services/mock/trips.ts. */
@Service
public class TripService {

    /** Uppercase, without the glyphs people misread aloud (0/O, 1/I). */
    private static final String INVITE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private static final String NO_MATCH = "That invite code does not match a trip.";
    private static final String BAD_DATE = "Pick a valid date.";

    private final TripRepository tripRepository;
    private final TripMemberRepository memberRepository;
    private final UserRepository userRepository;
    private final ChannelRepository channelRepository;
    private final TripAccess access;
    private final SecureRandom random = new SecureRandom();

    public TripService(TripRepository tripRepository, TripMemberRepository memberRepository,
                       UserRepository userRepository, ChannelRepository channelRepository, TripAccess access) {
        this.tripRepository = tripRepository;
        this.memberRepository = memberRepository;
        this.userRepository = userRepository;
        this.channelRepository = channelRepository;
        this.access = access;
    }

    /** Every trip the caller belongs to. */
    @Transactional(readOnly = true)
    public List<TripResponse> list(String callerId) {
        List<String> tripIds = memberRepository.findByUserId(callerId).stream().map(TripMember::getTripId).toList();
        return tripRepository.findByIdIn(tripIds).stream().map(TripResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public TripResponse get(String callerId, String tripId) {
        return TripResponse.from(access.requireMember(tripId, callerId));
    }

    /** A new trip, with the caller as its owner and a general channel ready to talk in. */
    @Transactional
    public TripResponse create(String callerId, CreateTripRequest req) {
        String name = req.name() == null ? "" : req.name().trim();
        if (name.isEmpty()) throw ApiException.invalid("Give the trip a name.");
        String destination = req.destination() == null ? "" : req.destination().trim();
        Trip trip = tripRepository.save(new Trip(null, name, destination,
                Times.parse(req.startDate(), BAD_DATE), Times.parse(req.endDate(), BAD_DATE),
                newInviteCode(), callerId, random.nextInt(360)));
        memberRepository.save(new TripMember(trip.getId(), callerId, TripMember.OWNER, Instant.now()));
        channelRepository.save(new Channel(null, trip.getId(), "general"));
        return TripResponse.from(trip);
    }

    @Transactional
    public TripResponse update(String callerId, String tripId, Patch patch) {
        Trip trip = access.requireMember(tripId, callerId);
        if (patch.has("name")) {
            String name = patch.string("name") == null ? "" : patch.string("name").trim();
            if (name.isEmpty()) throw ApiException.invalid("Give the trip a name.");
            trip.setName(name);
        }
        if (patch.has("destination")) {
            String destination = patch.string("destination");
            trip.setDestination(destination == null ? "" : destination.trim());
        }
        if (patch.has("startDate")) trip.setStartDate(Times.parse(patch.string("startDate"), BAD_DATE));
        if (patch.has("endDate")) trip.setEndDate(Times.parse(patch.string("endDate"), BAD_DATE));
        if (patch.has("allowanceCents")) {
            Long cents = patch.longValue("allowanceCents");
            if (cents == null || cents < 0) throw ApiException.invalid("Enter an allowance of zero or more.");
            trip.setAllowanceCents(cents);
        }
        if (patch.has("privateDebts")) {
            Boolean value = patch.bool("privateDebts");
            if (value == null) throw ApiException.invalid("That request couldn't be read.");
            trip.setPrivateDebts(value);
        }
        if (patch.has("defaultEfficiency")) {
            Double value = patch.doubleValue("defaultEfficiency");
            if (value == null || value <= 0) throw ApiException.invalid("Enter an efficiency above zero.");
            trip.setDefaultEfficiency(value);
        }
        if (patch.has("defaultPricePerLitreCents")) {
            Long value = patch.longValue("defaultPricePerLitreCents");
            if (value == null || value <= 0) throw ApiException.invalid("Enter a price above zero.");
            trip.setDefaultPricePerLitreCents(value);
        }
        return TripResponse.from(trip);
    }

    /** Look up a trip by invite code without joining it, for the join preview. */
    @Transactional(readOnly = true)
    public TripPreviewResponse previewByCode(String code) {
        Trip trip = tripRepository.findByInviteCode(normaliseCode(code))
                .orElseThrow(() -> ApiException.notFound(NO_MATCH));
        List<String> memberIds = memberRepository.findByTripIdOrderByJoinedAtAsc(trip.getId()).stream()
                .map(TripMember::getUserId).toList();
        List<ProfileResponse> members = userRepository.findAllById(memberIds).stream()
                .map(ProfileResponse::from).toList();
        return new TripPreviewResponse(TripResponse.from(trip), members);
    }

    /** Joins the trip behind a code. Joining twice is harmless. */
    @Transactional
    public TripResponse joinByCode(String callerId, String code) {
        Trip trip = tripRepository.findByInviteCode(normaliseCode(code))
                .orElseThrow(() -> ApiException.notFound(NO_MATCH));
        if (!memberRepository.existsByTripIdAndUserId(trip.getId(), callerId)) {
            memberRepository.save(new TripMember(trip.getId(), callerId, TripMember.MEMBER, Instant.now()));
        }
        return TripResponse.from(trip);
    }

    @Transactional
    public TripResponse regenerateCode(String callerId, String tripId) {
        access.requireOwner(tripId, callerId);
        Trip trip = access.requireTrip(tripId);
        trip.setInviteCode(newInviteCode());
        return TripResponse.from(trip);
    }

    /* Members */

    @Transactional(readOnly = true)
    public List<MemberResponse> listMembers(String callerId, String tripId) {
        access.requireMember(tripId, callerId);
        List<TripMember> members = memberRepository.findByTripIdOrderByJoinedAtAsc(tripId);
        Map<String, User> users = userRepository.findAllById(members.stream().map(TripMember::getUserId).toList())
                .stream().collect(Collectors.toMap(User::getId, Function.identity()));
        return members.stream().map(m -> {
            User user = users.get(m.getUserId());
            if (user == null) throw ApiException.notFound("A member profile is missing.");
            return MemberResponse.from(m, ProfileResponse.from(user));
        }).toList();
    }

    /** Leave the trip, or, for an owner, remove someone else from it. */
    @Transactional
    public void removeMember(String callerId, String tripId, String userId) {
        access.requireMember(tripId, callerId);
        if (!callerId.equals(userId) && !access.isOwner(tripId, callerId)) {
            throw ApiException.forbidden("Only the trip owner can remove someone.");
        }
        TripMember member = memberRepository.findByTripIdAndUserId(tripId, userId)
                .orElseThrow(() -> ApiException.notFound("That member is not on this trip."));
        if (member.isOwner() && memberRepository.countByTripIdAndRole(tripId, TripMember.OWNER) == 1) {
            throw ApiException.forbidden("A trip needs an owner. Hand it over before you leave.");
        }
        memberRepository.delete(member);
    }

    @Transactional
    public void updateRole(String callerId, String tripId, String userId, String role) {
        access.requireOwner(tripId, callerId);
        if (!TripMember.OWNER.equals(role) && !TripMember.MEMBER.equals(role)) {
            throw ApiException.invalid("A role is owner or member.");
        }
        TripMember member = memberRepository.findByTripIdAndUserId(tripId, userId)
                .orElseThrow(() -> ApiException.notFound("That member is not on this trip."));
        if (member.isOwner() && TripMember.MEMBER.equals(role)
                && memberRepository.countByTripIdAndRole(tripId, TripMember.OWNER) == 1) {
            throw ApiException.forbidden("A trip needs an owner. Make someone else owner first.");
        }
        member.setRole(role);
    }

    private String newInviteCode() {
        String code;
        do {
            StringBuilder builder = new StringBuilder(6);
            for (int i = 0; i < 6; i++) builder.append(INVITE_ALPHABET.charAt(random.nextInt(INVITE_ALPHABET.length())));
            code = builder.toString();
        } while (tripRepository.existsByInviteCode(code));
        return code;
    }

    private static String normaliseCode(String code) {
        return code == null ? "" : code.trim().toUpperCase();
    }
}
