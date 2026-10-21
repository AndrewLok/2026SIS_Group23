package com.voyager.backend.idea;

import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.voyager.backend.common.ApiException;
import com.voyager.backend.common.Patch;
import com.voyager.backend.common.Session;
import com.voyager.backend.idea.requestDTO.CreateIdeaRequest;
import com.voyager.backend.idea.responseDTO.IdeaResponse;
import com.voyager.backend.idea.responseDTO.VoteResponse;

import jakarta.servlet.http.HttpSession;

@RestController
@RequestMapping("/api")
public class IdeaController {

    private final IdeaService ideaService;

    public IdeaController(IdeaService ideaService) {
        this.ideaService = ideaService;
    }

    @GetMapping("/trips/{tripId}/ideas")
    public List<IdeaResponse> list(HttpSession session, @PathVariable String tripId) {
        return ideaService.list(Session.require(session), tripId);
    }

    @PostMapping("/trips/{tripId}/ideas")
    public ResponseEntity<IdeaResponse> create(HttpSession session, @PathVariable String tripId,
                                               @RequestBody CreateIdeaRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ideaService.create(Session.require(session), tripId, request));
    }

    @PatchMapping("/ideas/{ideaId}")
    public IdeaResponse update(HttpSession session, @PathVariable String ideaId,
                               @RequestBody Map<String, Object> patch) {
        return ideaService.update(Session.require(session), ideaId, new Patch(patch));
    }

    @PostMapping("/ideas/{ideaId}/status")
    public IdeaResponse setStatus(HttpSession session, @PathVariable String ideaId,
                                  @RequestBody Map<String, Object> body) {
        return ideaService.setStatus(Session.require(session), ideaId, new Patch(body).string("status"));
    }

    @PostMapping("/ideas/{ideaId}/attending")
    public IdeaResponse setAttending(HttpSession session, @PathVariable String ideaId,
                                     @RequestBody Map<String, Object> body) {
        Boolean attending = new Patch(body).bool("attending");
        if (attending == null) throw ApiException.invalid("That request couldn't be read.");
        return ideaService.setAttending(Session.require(session), ideaId, attending);
    }

    @DeleteMapping("/ideas/{ideaId}")
    public ResponseEntity<Void> remove(HttpSession session, @PathVariable String ideaId) {
        ideaService.remove(Session.require(session), ideaId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/trips/{tripId}/votes")
    public List<VoteResponse> votes(HttpSession session, @PathVariable String tripId) {
        return ideaService.listVotes(Session.require(session), tripId);
    }

    @PutMapping("/ideas/{ideaId}/vote")
    public ResponseEntity<Void> cast(HttpSession session, @PathVariable String ideaId,
                                     @RequestBody Map<String, Object> body) {
        Long value = new Patch(body).longValue("value");
        ideaService.cast(Session.require(session), ideaId, value == null ? null : value.intValue());
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/ideas/{ideaId}/vote")
    public ResponseEntity<Void> clear(HttpSession session, @PathVariable String ideaId) {
        ideaService.clear(Session.require(session), ideaId);
        return ResponseEntity.noContent().build();
    }
}
