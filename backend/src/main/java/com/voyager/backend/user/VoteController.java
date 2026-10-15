package com.voyager.backend.user;

import com.voyager.backend.trip.Activity;
import com.voyager.backend.trip.ActivityRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/activities/{activityId}/votes")
public class VoteController {

    @Autowired
    private VoteRepository voteRepository;

    @Autowired
    private ActivityRepository activityRepository;

    @Autowired
    private UserRepository userRepository;

    @PostMapping
    public ResponseEntity<?> castVote(@PathVariable UUID activityId, @RequestParam UUID userId) {
        Activity activity = activityRepository.findById(activityId).orElse(null);
        User user = userRepository.findById(userId).orElse(null);

        if (activity == null || user == null) {
            return ResponseEntity.notFound().build();
        }

        if (voteRepository.existsByUserIdAndActivityId(userId, activityId)) {
            return ResponseEntity.badRequest().body("User has already voted for this activity.");
        }

        Vote vote = new Vote(user, activity);
        Vote savedVote = voteRepository.save(vote);
        return ResponseEntity.ok(savedVote);
    }
}