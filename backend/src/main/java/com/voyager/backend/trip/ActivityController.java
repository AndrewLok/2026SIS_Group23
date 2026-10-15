package com.voyager.backend.trip;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/trips/{tripId}/activities")
public class ActivityController {

    @Autowired
    private ActivityRepository activityRepository;

    @Autowired
    private TripRepository tripRepository;

    @GetMapping
    public ResponseEntity<List<Activity>> getActivitiesByTrip(@PathVariable UUID tripId) {
        if (!tripRepository.existsById(tripId)) {
            return ResponseEntity.notFound().build();
        }
        List<Activity> activities = activityRepository.findAll()
                .stream()
                .filter(activity -> activity.getTrip().getId().equals(tripId))
                .toList();
        return ResponseEntity.ok(activities);
    }

    @PostMapping
    public ResponseEntity<Activity> createActivity(@PathVariable UUID tripId, @RequestBody Activity activityDetails) {
        return tripRepository.findById(tripId).map(trip -> {
            activityDetails.setTrip(trip);
            Activity savedActivity = activityRepository.save(activityDetails);
            return ResponseEntity.ok(savedActivity);
        }).orElse(ResponseEntity.notFound().build());
    }
}