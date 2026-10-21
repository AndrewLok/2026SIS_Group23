package com.voyager.backend.idea;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.voyager.backend.common.ApiException;
import com.voyager.backend.common.Patch;
import com.voyager.backend.common.Times;
import com.voyager.backend.idea.requestDTO.CreateIdeaRequest;
import com.voyager.backend.idea.responseDTO.IdeaResponse;
import com.voyager.backend.idea.responseDTO.VoteResponse;
import com.voyager.backend.trip.TripAccess;

/**
 * Activities and the votes on them. Mirrors the front end's services/mock/ideas.ts and
 * votes.ts, and the promotion rule in lib/voting.ts.
 */
@Service
public class IdeaService {

    private static final Set<String> CATEGORIES = Set.of("activity", "food", "stay", "travel");
    private static final Set<String> STATUSES = Set.of(Idea.PLANNED, Idea.VOTING, Idea.AGREED, Idea.REJECTED);
    private static final String DELETED = "That activity has been deleted.";
    private static final String BAD_TIME = "Pick a valid date and time.";

    private final IdeaRepository ideaRepository;
    private final VoteRepository voteRepository;
    private final TripAccess access;

    public IdeaService(IdeaRepository ideaRepository, VoteRepository voteRepository, TripAccess access) {
        this.ideaRepository = ideaRepository;
        this.voteRepository = voteRepository;
        this.access = access;
    }

    /** Votes needed to agree an idea: more than half of the current members. */
    static long agreeThreshold(long memberCount) {
        return memberCount / 2 + 1;
    }

    @Transactional(readOnly = true)
    public List<IdeaResponse> list(String callerId, String tripId) {
        access.requireMember(tripId, callerId);
        return ideaRepository.findByTripIdOrderByCreatedAtDesc(tripId).stream().map(IdeaResponse::from).toList();
    }

    @Transactional
    public IdeaResponse create(String callerId, String tripId, CreateIdeaRequest req) {
        access.requireMember(tripId, callerId);
        String title = req.title() == null ? "" : req.title().trim();
        if (title.isEmpty()) throw ApiException.invalid("Give the activity a title.");
        String category = checkCategory(req.category());
        boolean needsVote = Boolean.TRUE.equals(req.needsVote());
        Instant start = Times.parse(req.proposedStart(), BAD_TIME);
        Instant end = Times.parse(req.proposedEnd(), BAD_TIME);
        // Without a vote there is nothing else to settle on later, so it needs a time now or it
        // could never reach the calendar.
        if (!needsVote && start == null) throw ApiException.invalid("Pick a date and time.");
        checkTimes(start, end);

        List<String> attendees = req.attendeeIds() == null ? List.of() : req.attendeeIds();
        if (!needsVote && attendees.isEmpty()) throw ApiException.invalid("Pick at least one person who is going.");
        Set<String> memberIds = access.memberIds(tripId);
        if (!memberIds.containsAll(attendees)) throw ApiException.invalid("Everyone going has to be on the trip.");

        Instant now = Instant.now();
        Idea idea = new Idea(null, tripId, title, req.description() == null ? "" : req.description().trim(),
                category, start, end, Boolean.TRUE.equals(req.allDay()), needsVote ? Idea.VOTING : Idea.PLANNED,
                callerId, needsVote ? List.of(callerId) : new ArrayList<>(new LinkedHashSet<>(attendees)), now);
        ideaRepository.save(idea);
        if (needsVote) {
            // The proposer agrees with their own idea; anything else would be strange.
            voteRepository.save(new Vote(idea.getId(), callerId, 1, now));
        }
        return IdeaResponse.from(idea);
    }

    @Transactional
    public IdeaResponse update(String callerId, String ideaId, Patch patch) {
        Idea idea = requireIdea(ideaId, callerId);
        Instant start = patch.has("proposedStart") ? Times.parse(patch.string("proposedStart"), BAD_TIME)
                : idea.getProposedStart();
        Instant end = patch.has("proposedEnd") ? Times.parse(patch.string("proposedEnd"), BAD_TIME)
                : idea.getProposedEnd();
        checkTimes(start, end);
        if (patch.has("title")) {
            String title = patch.string("title") == null ? "" : patch.string("title").trim();
            if (title.isEmpty()) throw ApiException.invalid("Give the activity a title.");
            idea.setTitle(title);
        }
        if (patch.has("description")) {
            String description = patch.string("description");
            idea.setDescription(description == null ? "" : description.trim());
        }
        if (patch.has("category")) idea.setCategory(checkCategory(patch.string("category")));
        idea.setProposedStart(start);
        idea.setProposedEnd(end);
        if (patch.has("allDay")) idea.setAllDay(Boolean.TRUE.equals(patch.bool("allDay")));
        if (patch.has("attendeeIds")) {
            List<String> attendees = patch.strings("attendeeIds");
            if (attendees == null) attendees = List.of();
            // Someone already going who has since left can stay on the list.
            Set<String> allowed = access.memberIds(idea.getTripId());
            allowed.addAll(idea.getAttendeeIds());
            if (!allowed.containsAll(attendees)) throw ApiException.invalid("Everyone going has to be on the trip.");
            idea.setAttendeeIds(attendees);
        }
        return IdeaResponse.from(idea);
    }

    /** Explicit status change, used to reject an idea or put it back to voting. */
    @Transactional
    public IdeaResponse setStatus(String callerId, String ideaId, String status) {
        Idea idea = requireIdea(ideaId, callerId);
        if (status == null || !STATUSES.contains(status)) throw ApiException.invalid("That isn't a status.");
        if (!idea.getProposedBy().equals(callerId) && !access.isOwner(idea.getTripId(), callerId)) {
            throw ApiException.forbidden("Only whoever proposed it or the trip owner can do that.");
        }
        idea.setStatus(status);
        return IdeaResponse.from(idea);
    }

    /**
     * The caller says they are in or out. Anyone can do this for themselves once an activity is
     * going ahead; while it is still being voted on, the vote is how they say so.
     */
    @Transactional
    public IdeaResponse setAttending(String callerId, String ideaId, boolean attending) {
        Idea idea = requireIdea(ideaId, callerId);
        if (!idea.isOnThePlan()) throw ApiException.invalid("You can join once it is going ahead.");
        List<String> others = new ArrayList<>(idea.getAttendeeIds());
        others.remove(callerId);
        if (attending) others.add(callerId);
        idea.setAttendeeIds(others);
        return IdeaResponse.from(idea);
    }

    @Transactional
    public void remove(String callerId, String ideaId) {
        Idea idea = requireIdea(ideaId, callerId);
        if (!idea.getProposedBy().equals(callerId) && !access.isOwner(idea.getTripId(), callerId)) {
            throw ApiException.forbidden("Only whoever proposed it or the trip owner can delete it.");
        }
        voteRepository.deleteByIdeaId(ideaId);
        ideaRepository.delete(idea);
    }

    /* Votes */

    @Transactional(readOnly = true)
    public List<VoteResponse> listVotes(String callerId, String tripId) {
        access.requireMember(tripId, callerId);
        List<String> ideaIds = ideaRepository.findByTripIdOrderByCreatedAtDesc(tripId).stream()
                .map(Idea::getId).toList();
        return voteRepository.findByIdeaIdIn(ideaIds).stream()
                .sorted(Comparator.comparing(Vote::getCreatedAt))
                .map(VoteResponse::from)
                .toList();
    }

    /** Cast or change a vote. A second vote from the same member overwrites the first. */
    @Transactional
    public void cast(String callerId, String ideaId, Integer value) {
        if (value == null || (value != 1 && value != -1)) throw ApiException.invalid("A vote is 1 or -1.");
        Idea idea = requireVotable(ideaId, callerId);
        Instant now = Instant.now();
        voteRepository.findByIdeaIdAndUserId(ideaId, callerId).ifPresentOrElse(vote -> {
            vote.setValue(value);
            vote.setCreatedAt(now);
        }, () -> voteRepository.save(new Vote(ideaId, callerId, value, now)));
        voteRepository.flush();
        reconcileStatus(idea);
    }

    @Transactional
    public void clear(String callerId, String ideaId) {
        Idea idea = requireVotable(ideaId, callerId);
        voteRepository.findByIdeaIdAndUserId(ideaId, callerId).ifPresent(voteRepository::delete);
        voteRepository.flush();
        reconcileStatus(idea);
    }

    /**
     * Recalculate one idea's status from its votes, after every cast and clear. Only ever
     * promotes to agreed or demotes back to voting: a rejection is a deliberate act, and a
     * planned activity was never put to a vote. The moment a vote passes, everyone who voted
     * for it is marked as going; after that, attendance is each member's own call.
     */
    private void reconcileStatus(Idea idea) {
        if (Idea.REJECTED.equals(idea.getStatus()) || Idea.PLANNED.equals(idea.getStatus())) return;
        long memberCount = access.memberCount(idea.getTripId());
        List<String> agreeIds = voteRepository.findByIdeaId(idea.getId()).stream()
                .filter(v -> v.getValue() == 1)
                .sorted(Comparator.comparing(Vote::getCreatedAt))
                .map(Vote::getUserId)
                .toList();
        String before = idea.getStatus();
        boolean passed = memberCount > 0 && agreeIds.size() >= agreeThreshold(memberCount);
        idea.setStatus(passed ? Idea.AGREED : Idea.VOTING);
        if (Idea.VOTING.equals(before) && Idea.AGREED.equals(idea.getStatus())) {
            List<String> attendees = new ArrayList<>(idea.getAttendeeIds());
            attendees.addAll(agreeIds);
            idea.setAttendeeIds(attendees);
        }
    }

    private Idea requireIdea(String ideaId, String callerId) {
        Idea idea = ideaRepository.findById(ideaId).orElseThrow(() -> ApiException.notFound(DELETED));
        access.requireMember(idea.getTripId(), callerId);
        return idea;
    }

    /** Votes only make sense on something that was put to the group. */
    private Idea requireVotable(String ideaId, String callerId) {
        Idea idea = requireIdea(ideaId, callerId);
        if (Idea.PLANNED.equals(idea.getStatus())) throw ApiException.invalid("This one was added without a vote.");
        return idea;
    }

    /** An end, when there is one, has to come after the start. */
    private static void checkTimes(Instant start, Instant end) {
        if (end != null && start == null) throw ApiException.invalid("Pick when it starts too.");
        if (start != null && end != null && !end.isAfter(start)) {
            throw ApiException.invalid("It has to finish after it starts.");
        }
    }

    private static String checkCategory(String category) {
        if (category == null || !CATEGORIES.contains(category)) throw ApiException.invalid("Pick a category.");
        return category;
    }
}
