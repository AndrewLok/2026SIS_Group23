package com.voyager.backend.trip;

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

import com.voyager.backend.common.Patch;
import com.voyager.backend.common.Session;
import com.voyager.backend.trip.requestDTO.CreateTripRequest;
import com.voyager.backend.trip.responseDTO.MemberResponse;
import com.voyager.backend.trip.responseDTO.TripPreviewResponse;
import com.voyager.backend.trip.responseDTO.TripResponse;

import jakarta.servlet.http.HttpSession;

@RestController
@RequestMapping("/api")
public class TripController {

    private final TripService tripService;

    public TripController(TripService tripService) {
        this.tripService = tripService;
    }

    @GetMapping("/trips")
    public List<TripResponse> list(HttpSession session) {
        return tripService.list(Session.require(session));
    }

    @PostMapping("/trips")
    public ResponseEntity<TripResponse> create(HttpSession session, @RequestBody CreateTripRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(tripService.create(Session.require(session), request));
    }

    @GetMapping("/trips/{tripId}")
    public TripResponse get(HttpSession session, @PathVariable String tripId) {
        return tripService.get(Session.require(session), tripId);
    }

    @PatchMapping("/trips/{tripId}")
    public TripResponse update(HttpSession session, @PathVariable String tripId,
                               @RequestBody Map<String, Object> patch) {
        return tripService.update(Session.require(session), tripId, new Patch(patch));
    }

    @PostMapping("/trips/{tripId}/invite-code")
    public TripResponse regenerateCode(HttpSession session, @PathVariable String tripId) {
        return tripService.regenerateCode(Session.require(session), tripId);
    }

    /** Open to anyone holding the code, signed in or not, so the join screen can show what it is. */
    @GetMapping("/invites/{code}")
    public TripPreviewResponse preview(@PathVariable String code) {
        return tripService.previewByCode(code);
    }

    @PostMapping("/invites/{code}/join")
    public TripResponse join(HttpSession session, @PathVariable String code) {
        return tripService.joinByCode(Session.require(session), code);
    }

    @GetMapping("/trips/{tripId}/members")
    public List<MemberResponse> members(HttpSession session, @PathVariable String tripId) {
        return tripService.listMembers(Session.require(session), tripId);
    }

    @DeleteMapping("/trips/{tripId}/members/{userId}")
    public ResponseEntity<Void> removeMember(HttpSession session, @PathVariable String tripId,
                                             @PathVariable String userId) {
        tripService.removeMember(Session.require(session), tripId, userId);
        return ResponseEntity.noContent().build();
    }

    @PatchMapping("/trips/{tripId}/members/{userId}")
    public ResponseEntity<Void> updateRole(HttpSession session, @PathVariable String tripId,
                                           @PathVariable String userId, @RequestBody Map<String, Object> body) {
        tripService.updateRole(Session.require(session), tripId, userId, new Patch(body).string("role"));
        return ResponseEntity.noContent().build();
    }
}
