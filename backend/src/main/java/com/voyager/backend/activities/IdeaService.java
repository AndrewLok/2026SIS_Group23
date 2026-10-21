package com.voyager.backend.activities;

import java.time.Instant;
import java.time.format.DateTimeParseException;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.voyager.backend.activities.requestdto.CreateIdeaRequest;
import com.voyager.backend.common.ApiException;
import com.voyager.backend.common.Limits;
import com.voyager.backend.trip.Role;
import com.voyager.backend.trip.TripMember;
import com.voyager.backend.trip.TripMemberRepository;
import com.voyager.backend.trip.TripRepository;

// The rules for activities (the frontend's "ideas") and the votes on them, in one place:
//   - Only people on a trip can see its activities or votes, or add to them. For anyone else they
//     do not exist (404), the same way a trip you are not on does not exist.
//   - An activity is either added straight to the plan (PLANNED, with the people who are going) or
//     put to the group (VOTING). The person who puts it to a vote counts as agreeing with it.
//   - It is carried when more than half of the people on the trip agree (see Voting). The status
//     follows the votes: it moves to AGREED the moment the count is reached, and back to VOTING if
//     a vote is withdrawn or changed. At the moment it is carried, everyone who agreed is marked as
//     going; after that, being in or out is each person's own call.
//   - Only the person who added an activity, or the trip's owner, can change it, rule it out, put
//     it back to a vote or delete it. Anyone on the trip can vote and say they are in or out.
//   - Someone who leaves the trip takes their votes and their "going" with them, and the activities
//     still being decided are counted again against the smaller group.
//     (Someone joining changes the bar for the next vote but does not undo what was already carried.)
//
// Everything that changes anything first locks the trip's row, so activity changes on one trip run
// one after the other. That is what lets "count the votes and set the status" be a plain read then
// write: two people voting at the same moment cannot both see "one short" and leave a carried
// activity marked as voting, and nobody can vote while the group is being changed. It is also the
// same lock that TripService takes to change who is on the trip, so the head count used for the
// threshold is always current.

@Service
public class IdeaService {

    private static final String NO_SUCH_TRIP = "That trip does not exist.";
    private static final String NO_SUCH_IDEA = "That activity has been deleted.";
    private static final String NOT_YOURS_TO_CHANGE =
            "Only the person who added this, or the trip owner, can change it.";
    private static final String NOT_YOURS_TO_DELETE =
            "Only the person who added this, or the trip owner, can delete it.";
    private static final String NEVER_VOTED_ON = "This one was added without a vote.";

    // An activity together with the people going, for responses that show both.
    public record IdeaDetail(Idea idea, List<UUID> attendeeIds) {}

    private record Locked(Idea idea, TripMember me) {}

    private final IdeaRepository ideas;
    private final VoteRepository votes;
    private final IdeaAttendeeRepository attendees;
    private final TripRepository trips;
    private final TripMemberRepository members;

    public IdeaService(IdeaRepository ideas, VoteRepository votes, IdeaAttendeeRepository attendees,
            TripRepository trips, TripMemberRepository members) {
        this.ideas = ideas;
        this.votes = votes;
        this.attendees = attendees;
        this.trips = trips;
        this.members = members;
    }

    // Stored times are kept to the microsecond, which is what the database holds, so something reads
    // the same in the response that creates it as it does when listed later.
    private static Instant now() {
        return Instant.now().truncatedTo(ChronoUnit.MICROS);
    }

    /* Looking things up */

    private static ApiException noSuchTrip() {
        return ApiException.notFound(NO_SUCH_TRIP);
    }

    private static ApiException noSuchIdea() {
        return ApiException.notFound(NO_SUCH_IDEA);
    }

    // A trip you are not on looks exactly like a trip that is not there.
    private TripMember requireMember(UUID tripId, UUID userId) {
        return members.findByTripIdAndUserId(tripId, userId).orElseThrow(IdeaService::noSuchTrip);
    }

    // Takes the trip's lock and then checks the person is on it, so what follows is current: if they
    // were removed while this request waited, they are refused. Must come before any other read.
    private TripMember lockTripAsMember(UUID tripId, UUID userId) {
        trips.findLockedById(tripId).orElseThrow(IdeaService::noSuchTrip);
        return requireMember(tripId, userId);
    }

    // The same for something that lives under an activity. The activity is first looked at only for
    // the trip it belongs to, because it must not be read until the trip is locked.
    private Locked lockIdea(UUID ideaId, UUID userId) {
        UUID tripId = ideas.findTripIdById(ideaId).orElseThrow(IdeaService::noSuchIdea);
        trips.findLockedById(tripId).orElseThrow(IdeaService::noSuchIdea);
        TripMember me = members.findByTripIdAndUserId(tripId, userId).orElseThrow(IdeaService::noSuchIdea);
        Idea idea = ideas.findById(ideaId).orElseThrow(IdeaService::noSuchIdea);
        return new Locked(idea, me);
    }

    private static void requireProposerOrOwner(Idea idea, TripMember me, String message) {
        if (!idea.getProposedBy().equals(me.getUserId()) && me.getRole() != Role.OWNER) {
            throw ApiException.forbidden(message);
        }
    }

    private static void requireVotable(Idea idea) {
        if (idea.getStatus() == IdeaStatus.PLANNED) {
            throw ApiException.invalid(NEVER_VOTED_ON);
        }
    }

    private Set<UUID> memberIds(UUID tripId) {
        return members.findByTripId(tripId).stream().map(TripMember::getUserId).collect(Collectors.toSet());
    }

    // People in the order they said they were going.
    private static final Comparator<IdeaAttendee> GOING_ORDER =
            Comparator.comparing(IdeaAttendee::getCreatedAt).thenComparing(IdeaAttendee::getUserId);

    private IdeaDetail detailOf(Idea idea) {
        List<UUID> going = attendees.findByIdeaId(idea.getId()).stream()
                .sorted(GOING_ORDER)
                .map(IdeaAttendee::getUserId)
                .toList();
        return new IdeaDetail(idea, going);
    }

    /* Reading */

    // Newest first.
    @Transactional(readOnly = true)
    public List<IdeaDetail> list(UUID tripId, UUID userId) {
        requireMember(tripId, userId);
        List<Idea> found = ideas.findByTripId(tripId).stream()
                .sorted(Comparator.comparing(Idea::getCreatedAt).thenComparing(Idea::getId).reversed())
                .toList();
        if (found.isEmpty()) {
            return List.of();
        }
        Map<UUID, List<IdeaAttendee>> going = new HashMap<>();
        attendees.findByIdeaIdIn(found.stream().map(Idea::getId).toList())
                .forEach(a -> going.computeIfAbsent(a.getIdeaId(), k -> new ArrayList<>()).add(a));
        return found.stream()
                .map(idea -> new IdeaDetail(idea, going.getOrDefault(idea.getId(), List.of()).stream()
                        .sorted(GOING_ORDER)
                        .map(IdeaAttendee::getUserId)
                        .toList()))
                .toList();
    }

    // Every vote on every activity of the trip, so the screen can show who voted which way.
    @Transactional(readOnly = true)
    public List<Vote> votesFor(UUID tripId, UUID userId) {
        requireMember(tripId, userId);
        List<UUID> ideaIds = ideas.findByTripId(tripId).stream().map(Idea::getId).toList();
        if (ideaIds.isEmpty()) {
            return List.of();
        }
        return votes.findByIdeaIdIn(ideaIds).stream()
                .sorted(Comparator.comparing(Vote::getCreatedAt).thenComparing(Vote::getId))
                .toList();
    }

    /* Adding */

    @Transactional
    public IdeaDetail create(UUID tripId, UUID userId, CreateIdeaRequest request) {
        lockTripAsMember(tripId, userId);

        String title = request.title() == null ? "" : request.title().trim();
        if (title.isEmpty()) {
            throw ApiException.invalid("Give the activity a title.");
        }
        if (title.length() > Limits.IDEA_TITLE) {
            throw ApiException.invalid(Limits.tooLong("title", Limits.IDEA_TITLE));
        }
        String description = checkedDescription(request.description() == null ? "" : request.description().trim());
        IdeaCategory category = IdeaCategory.fromWire(request.category());
        if (category == null) {
            throw ApiException.invalid("Pick a category.");
        }
        Instant start = instantOrNull(request.proposedStart(), "proposedStart");
        Instant end = instantOrNull(request.proposedEnd(), "proposedEnd");
        if (request.needsVote() == null) {
            throw ApiException.invalid("needsVote has to be true or false.");
        }
        boolean needsVote = request.needsVote();
        boolean allDay = request.allDay() != null && request.allDay();
        checkTimes(start, end);

        // Skipping the vote leaves nothing else to settle later, so it needs a time and some people now.
        Set<UUID> going = new LinkedHashSet<>();
        if (!needsVote) {
            if (start == null) {
                throw ApiException.invalid("Pick a date and time.");
            }
            going = attendeeIdsFrom(request.attendeeIds());
            if (going.isEmpty()) {
                throw ApiException.invalid("Pick at least one person who is going.");
            }
            if (!memberIds(tripId).containsAll(going)) {
                throw ApiException.invalid("Everyone going has to be on the trip.");
            }
        }

        Instant at = now();
        Idea idea = ideas.save(new Idea(tripId, title, description, category, start, end, allDay,
                needsVote ? IdeaStatus.VOTING : IdeaStatus.PLANNED, userId, at));
        if (needsVote) {
            // The person proposing it agrees with it; anything else would be strange.
            votes.save(new Vote(idea.getId(), userId, true, at));
            addAttendees(idea, List.of(userId), at);
            recount(idea, at); // On a trip of one, that is already enough.
        } else {
            addAttendees(idea, going, at);
        }
        return detailOf(idea);
    }

    /* Changing */

    // A partial update. The body is a plain map so that "leave it alone" and "clear it" can be told
    // apart for the times. Keys that are not listed here (id, status, proposedBy, ...) are ignored:
    // the status changes only through setStatus and the votes.
    @Transactional
    public IdeaDetail update(UUID ideaId, UUID userId, Map<String, Object> patch) {
        Locked locked = lockIdea(ideaId, userId);
        Idea idea = locked.idea();
        requireProposerOrOwner(idea, locked.me(), NOT_YOURS_TO_CHANGE);

        if (patch.containsKey("title")) {
            String title = text(patch.get("title"), "title").trim();
            if (title.isEmpty()) {
                throw ApiException.invalid("Give the activity a title.");
            }
            if (title.length() > Limits.IDEA_TITLE) {
                throw ApiException.invalid(Limits.tooLong("title", Limits.IDEA_TITLE));
            }
            idea.setTitle(title);
        }
        if (patch.containsKey("description")) {
            idea.setDescription(checkedDescription(text(patch.get("description"), "description").trim()));
        }
        if (patch.containsKey("category")) {
            IdeaCategory category = IdeaCategory.fromWire(text(patch.get("category"), "category"));
            if (category == null) {
                throw ApiException.invalid("Pick a category.");
            }
            idea.setCategory(category);
        }
        if (patch.containsKey("proposedStart")) {
            idea.setProposedStart(instantOrNull(patch.get("proposedStart"), "proposedStart"));
        }
        if (patch.containsKey("proposedEnd")) {
            idea.setProposedEnd(instantOrNull(patch.get("proposedEnd"), "proposedEnd"));
        }
        if (patch.containsKey("allDay")) {
            if (!(patch.get("allDay") instanceof Boolean allDay)) {
                throw ApiException.invalid("allDay has to be true or false.");
            }
            idea.setAllDay(allDay);
        }
        checkTimes(idea.getProposedStart(), idea.getProposedEnd());
        if (idea.getStatus() == IdeaStatus.PLANNED && idea.getProposedStart() == null) {
            throw ApiException.invalid("Pick a date and time.");
        }

        if (patch.containsKey("attendeeIds")) {
            if (!idea.getStatus().onThePlan()) {
                throw ApiException.invalid("You can set who is going once it is going ahead.");
            }
            if (!(patch.get("attendeeIds") instanceof List<?> raw)) {
                throw ApiException.invalid("attendeeIds has to be a list.");
            }
            List<String> asText = new ArrayList<>();
            for (Object item : raw) {
                if (!(item instanceof String string)) {
                    throw ApiException.invalid("attendeeIds has to be a list of ids.");
                }
                asText.add(string);
            }
            Set<UUID> wanted = attendeeIdsFrom(asText);
            if (!memberIds(idea.getTripId()).containsAll(wanted)) {
                throw ApiException.invalid("Everyone going has to be on the trip.");
            }
            replaceAttendees(idea, wanted, now());
        }

        ideas.save(idea);
        return detailOf(idea);
    }

    // Rule an activity out, or put it back to the group. Only those two: AGREED is the votes' to
    // give, and PLANNED is how an activity is made. Putting one back counts the votes again, so one
    // that already has enough is carried straight away.
    @Transactional
    public IdeaDetail setStatus(UUID ideaId, UUID userId, String status) {
        IdeaStatus wanted = IdeaStatus.fromWire(status);
        if (wanted != IdeaStatus.REJECTED && wanted != IdeaStatus.VOTING) {
            throw ApiException.invalid("Status has to be rejected or voting.");
        }
        Locked locked = lockIdea(ideaId, userId);
        Idea idea = locked.idea();
        requireProposerOrOwner(idea, locked.me(), NOT_YOURS_TO_CHANGE);
        requireVotable(idea);

        if (wanted == IdeaStatus.REJECTED) {
            idea.setStatus(IdeaStatus.REJECTED);
            ideas.save(idea);
        } else if (idea.getStatus() == IdeaStatus.REJECTED) {
            idea.setStatus(IdeaStatus.VOTING);
            recount(idea, now());
        }
        // Asking for "voting" on something already voting or agreed changes nothing.
        return detailOf(idea);
    }

    // "I'm in" and "I'm out". Anyone on the trip can do this for themselves once an activity is
    // going ahead; while it is still being voted on, the vote is how they say so. Saying the same
    // thing twice is fine.
    @Transactional
    public IdeaDetail setAttending(UUID ideaId, UUID userId, boolean attending) {
        Locked locked = lockIdea(ideaId, userId);
        Idea idea = locked.idea();
        if (!idea.getStatus().onThePlan()) {
            throw ApiException.invalid("You can join once it is going ahead.");
        }
        var existing = attendees.findByIdeaIdAndUserId(ideaId, userId);
        if (attending && existing.isEmpty()) {
            attendees.save(new IdeaAttendee(ideaId, userId, now()));
        } else if (!attending && existing.isPresent()) {
            attendees.delete(existing.get());
        }
        return detailOf(idea);
    }

    @Transactional
    public void remove(UUID ideaId, UUID userId) {
        Locked locked = lockIdea(ideaId, userId);
        requireProposerOrOwner(locked.idea(), locked.me(), NOT_YOURS_TO_DELETE);
        votes.deleteByIdeaId(ideaId);
        attendees.deleteByIdeaId(ideaId);
        ideas.delete(locked.idea());
    }

    /* Voting */

    // Cast or change a vote: a second vote from the same person replaces the first. A vote can be
    // cast on anything that was put to the group, including one that was since ruled out (that stays
    // ruled out), but not on something that was added straight to the plan.
    @Transactional
    public void cast(UUID ideaId, UUID userId, Integer value) {
        if (value == null || (value != 1 && value != -1)) {
            throw ApiException.invalid("Vote for or against.");
        }
        Locked locked = lockIdea(ideaId, userId);
        requireVotable(locked.idea());

        Instant at = now();
        Vote vote = votes.findByIdeaIdAndUserId(ideaId, userId).orElse(null);
        if (vote == null) {
            votes.save(new Vote(ideaId, userId, value == 1, at));
        } else {
            vote.setAgree(value == 1);
            vote.setCreatedAt(at);
            votes.save(vote);
        }
        recount(locked.idea(), at);
    }

    // Withdraw a vote. Withdrawing one that is not there is fine.
    @Transactional
    public void clear(UUID ideaId, UUID userId) {
        Locked locked = lockIdea(ideaId, userId);
        requireVotable(locked.idea());
        votes.findByIdeaIdAndUserId(ideaId, userId).ifPresent(votes::delete);
        recount(locked.idea(), now());
    }

    /* Leaving */

    // Called by TripService, inside the transaction that removes the person (so the trip is already
    // locked and the head count no longer includes them). Their votes and their "going" go with
    // them, and what is still being decided is counted again against the smaller group.
    @Transactional
    public void memberLeft(UUID tripId, UUID leaverId) {
        Instant at = now();
        for (Idea idea : ideas.findByTripId(tripId)) {
            votes.findByIdeaIdAndUserId(idea.getId(), leaverId).ifPresent(votes::delete);
            attendees.findByIdeaIdAndUserId(idea.getId(), leaverId).ifPresent(attendees::delete);
            if (idea.getStatus() == IdeaStatus.VOTING || idea.getStatus() == IdeaStatus.AGREED) {
                recount(idea, at);
            }
        }
    }

    /* Counting */

    // Work the status out again from the votes and the trip's current head count.
    private void recount(Idea idea, Instant at) {
        List<Vote> agreeing = votes.findByIdeaId(idea.getId()).stream()
                .filter(Vote::isAgree)
                .sorted(Comparator.comparing(Vote::getCreatedAt).thenComparing(Vote::getUserId))
                .toList();
        IdeaStatus before = idea.getStatus();
        IdeaStatus after = Voting.statusFor(before, agreeing.size(), members.countByTripId(idea.getTripId()));
        if (after != before) {
            idea.setStatus(after);
            ideas.save(idea);
        }
        // The moment it is carried, everyone who agreed is going. After that it is up to each person.
        if (before == IdeaStatus.VOTING && after == IdeaStatus.AGREED) {
            addAttendees(idea, agreeing.stream().map(Vote::getUserId).toList(), at);
        }
    }

    /* Who is going */

    // Adds the people who are not already there, in the order given.
    private void addAttendees(Idea idea, Collection<UUID> userIds, Instant at) {
        Set<UUID> there = attendees.findByIdeaId(idea.getId()).stream()
                .map(IdeaAttendee::getUserId)
                .collect(Collectors.toCollection(HashSet::new));
        int placed = 0;
        for (UUID userId : userIds) {
            if (there.add(userId)) {
                // A microsecond apart, so they keep the order they were added in.
                attendees.save(new IdeaAttendee(idea.getId(), userId, at.plus(placed++, ChronoUnit.MICROS)));
            }
        }
    }

    // Makes the list exactly these people, leaving anyone who stays as they were.
    private void replaceAttendees(Idea idea, Set<UUID> wanted, Instant at) {
        for (IdeaAttendee current : attendees.findByIdeaId(idea.getId())) {
            if (!wanted.contains(current.getUserId())) {
                attendees.delete(current);
            }
        }
        addAttendees(idea, wanted, at);
    }

    /* Request values. Each says which field was wrong, so the message can be shown as it is. */

    private static String checkedDescription(String description) {
        if (description.length() > Limits.IDEA_DESCRIPTION) {
            throw ApiException.invalid(Limits.tooLong("description", Limits.IDEA_DESCRIPTION));
        }
        return description;
    }

    private static void checkTimes(Instant start, Instant end) {
        if (end != null && start == null) {
            throw ApiException.invalid("Add a start time before an end time.");
        }
        if (end != null && end.isBefore(start)) {
            throw ApiException.invalid("It cannot end before it starts.");
        }
    }

    private static Set<UUID> attendeeIdsFrom(List<String> raw) {
        Set<UUID> ids = new LinkedHashSet<>();
        if (raw == null) {
            return ids;
        }
        for (String item : raw) {
            try {
                ids.add(UUID.fromString(item == null ? "" : item.trim()));
            } catch (IllegalArgumentException e) {
                throw ApiException.invalid("Everyone going has to be on the trip.");
            }
        }
        return ids;
    }

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
                return Instant.parse(string.trim()).truncatedTo(ChronoUnit.MICROS);
            } catch (DateTimeParseException e) {
                throw ApiException.invalid(field + " has to be a date and time like 2026-11-08T00:00:00Z.");
            }
        }
        throw ApiException.invalid(field + " has to be a date and time like 2026-11-08T00:00:00Z.");
    }
}
