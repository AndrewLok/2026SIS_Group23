package com.voyager.backend.trip;

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

import com.voyager.backend.common.ApiException;
import com.voyager.backend.security.CurrentUser;
import com.voyager.backend.trip.requestdto.*;
import com.voyager.backend.trip.responsedto.MemberResponse;
import com.voyager.backend.trip.responsedto.TripPreviewResponse;
import com.voyager.backend.trip.responsedto.TripResponse;

// Every endpoint here needs a signed-in user (see SecurityConfig). The rules about who may do
// what are in TripService; this class only translates HTTP to and from it.

@RestController
@RequestMapping("/api/trips")
public class TripController {

    private final TripService tripService;

    public TripController(TripService tripService) {
        this.tripService = tripService;
    }

    /* Trips */

    // The trips the signed-in person is on, and no one else's.
    @GetMapping
    public ResponseEntity<List<TripResponse>> list(Authentication authentication) {
        List<TripResponse> trips = tripService.listFor(CurrentUser.id(authentication)).stream()
                .map(TripResponse::from)
                .toList();
        return ResponseEntity.ok(trips);
    }

    @PostMapping
    public ResponseEntity<TripResponse> create(@RequestBody CreateTripRequest request, Authentication authentication) {
        Trip trip = tripService.create(CurrentUser.id(authentication), request);
        return ResponseEntity.status(HttpStatus.CREATED).body(TripResponse.from(trip));
    }

    @GetMapping("/{tripId}")
    public ResponseEntity<TripResponse> get(@PathVariable UUID tripId, Authentication authentication) {
        return ResponseEntity.ok(TripResponse.from(tripService.get(tripId, CurrentUser.id(authentication))));
    }

    // Partial update: send only the fields to change. See TripService.update for who may change what.
    @PatchMapping("/{tripId}")
    public ResponseEntity<TripResponse> update(@PathVariable UUID tripId, @RequestBody Map<String, Object> patch, Authentication authentication) {
        return ResponseEntity.ok(TripResponse.from(tripService.update(tripId, CurrentUser.id(authentication), patch)));
    }

    /* Invite codes */

    // Look at a trip by its code before joining it.
    @GetMapping("/preview/{code}")
    public ResponseEntity<TripPreviewResponse> preview(@PathVariable String code) {
        return ResponseEntity.ok(TripPreviewResponse.from(tripService.preview(code)));
    }

    @PostMapping("/join/{code}")
    public ResponseEntity<TripResponse> join(@PathVariable String code, Authentication authentication) {
        return ResponseEntity.ok(TripResponse.from(tripService.join(code, CurrentUser.id(authentication))));
    }

    @PostMapping("/{tripId}/regenerate-code")
    public ResponseEntity<TripResponse> regenerateCode(@PathVariable UUID tripId, Authentication authentication) {
        return ResponseEntity.ok(TripResponse.from(tripService.regenerateCode(tripId, CurrentUser.id(authentication))));
    }

    /* Members */

    @GetMapping("/{tripId}/members")
    public ResponseEntity<List<MemberResponse>> members(@PathVariable UUID tripId, Authentication authentication) {
        List<MemberResponse> members = tripService.members(tripId, CurrentUser.id(authentication)).stream()
                .map(MemberResponse::from)
                .toList();
        return ResponseEntity.ok(members);
    }

    // Removes someone, or leaves the trip when userId is your own.
    @DeleteMapping("/{tripId}/members/{userId}")
    public ResponseEntity<Void> removeMember(@PathVariable UUID tripId, @PathVariable UUID userId, Authentication authentication) {
        tripService.removeMember(tripId, CurrentUser.id(authentication), userId);
        return ResponseEntity.noContent().build();
    }

    @PatchMapping("/{tripId}/members/{userId}")
    public ResponseEntity<Void> updateRole(@PathVariable UUID tripId, @PathVariable UUID userId, @RequestBody UpdateRoleRequest request, Authentication authentication) {
        Role role = Role.fromWire(request.role());
        if (role == null) {
            throw ApiException.invalid("Role has to be owner or member.");
        }
        tripService.updateRole(tripId, CurrentUser.id(authentication), userId, role);
        return ResponseEntity.noContent().build();
    }
}
