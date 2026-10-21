package com.voyager.backend.activities;

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
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.voyager.backend.activities.requestdto.AttendanceRequest;
import com.voyager.backend.activities.requestdto.CreateIdeaRequest;
import com.voyager.backend.activities.requestdto.StatusRequest;
import com.voyager.backend.activities.requestdto.VoteRequest;
import com.voyager.backend.activities.responsedto.IdeaResponse;
import com.voyager.backend.activities.responsedto.VoteResponse;
import com.voyager.backend.common.ApiException;
import com.voyager.backend.security.CurrentUser;

// Every endpoint here needs a signed-in user (see SecurityConfig). The rules about who may do what
// are in IdeaService; this class only translates HTTP to and from it.

@RestController
@RequestMapping("/api")
public class IdeaController {

    private final IdeaService service;

    public IdeaController(IdeaService service) {
        this.service = service;
    }

    /* Activities */

    @GetMapping("/trips/{tripId}/ideas")
    public ResponseEntity<List<IdeaResponse>> list(@PathVariable UUID tripId, Authentication authentication) {
        List<IdeaResponse> body = service.list(tripId, CurrentUser.id(authentication)).stream()
                .map(IdeaResponse::from)
                .toList();
        return ResponseEntity.ok(body);
    }

    @PostMapping("/trips/{tripId}/ideas")
    public ResponseEntity<IdeaResponse> create(@PathVariable UUID tripId, @RequestBody CreateIdeaRequest request,
            Authentication authentication) {
        var created = service.create(tripId, CurrentUser.id(authentication), request);
        return ResponseEntity.status(HttpStatus.CREATED).body(IdeaResponse.from(created));
    }

    // Partial update: send only the fields to change. See IdeaService.update.
    @PatchMapping("/ideas/{ideaId}")
    public ResponseEntity<IdeaResponse> update(@PathVariable UUID ideaId, @RequestBody Map<String, Object> patch,
            Authentication authentication) {
        return ResponseEntity.ok(IdeaResponse.from(service.update(ideaId, CurrentUser.id(authentication), patch)));
    }

    // Rule an activity out ("rejected") or put it back to the group ("voting").
    @PutMapping("/ideas/{ideaId}/status")
    public ResponseEntity<IdeaResponse> setStatus(@PathVariable UUID ideaId, @RequestBody StatusRequest request,
            Authentication authentication) {
        return ResponseEntity.ok(
                IdeaResponse.from(service.setStatus(ideaId, CurrentUser.id(authentication), request.status())));
    }

    // The signed-in person says they are in or out.
    @PutMapping("/ideas/{ideaId}/attendance")
    public ResponseEntity<IdeaResponse> setAttending(@PathVariable UUID ideaId, @RequestBody AttendanceRequest request,
            Authentication authentication) {
        if (request.attending() == null) {
            throw ApiException.invalid("attending has to be true or false.");
        }
        return ResponseEntity.ok(IdeaResponse.from(
                service.setAttending(ideaId, CurrentUser.id(authentication), request.attending())));
    }

    @DeleteMapping("/ideas/{ideaId}")
    public ResponseEntity<Void> remove(@PathVariable UUID ideaId, Authentication authentication) {
        service.remove(ideaId, CurrentUser.id(authentication));
        return ResponseEntity.noContent().build();
    }

    /* Votes */

    @GetMapping("/trips/{tripId}/votes")
    public ResponseEntity<List<VoteResponse>> votes(@PathVariable UUID tripId, Authentication authentication) {
        List<VoteResponse> body = service.votesFor(tripId, CurrentUser.id(authentication)).stream()
                .map(VoteResponse::from)
                .toList();
        return ResponseEntity.ok(body);
    }

    // Cast or change the signed-in person's vote: 1 for, -1 against.
    @PutMapping("/ideas/{ideaId}/vote")
    public ResponseEntity<Void> cast(@PathVariable UUID ideaId, @RequestBody VoteRequest request,
            Authentication authentication) {
        service.cast(ideaId, CurrentUser.id(authentication), request.value());
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/ideas/{ideaId}/vote")
    public ResponseEntity<Void> clear(@PathVariable UUID ideaId, Authentication authentication) {
        service.clear(ideaId, CurrentUser.id(authentication));
        return ResponseEntity.noContent().build();
    }
}
