package com.voyager.backend.controller;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.voyager.backend.dto.CreateTripRequest;
import com.voyager.backend.model.Trip;
import com.voyager.backend.repository.TripRepository;

@RestController
@RequestMapping("/api/trips")
public class TripController {

    private final TripRepository tripRepository;

    // Direct repository injection to skip creating a Service layer for now
    public TripController(TripRepository tripRepository) {
        this.tripRepository = tripRepository;
    }

    @PostMapping
    public ResponseEntity<Trip> createTrip(@RequestBody CreateTripRequest request) {
        Trip trip = Trip.builder()
                .destination(request.destination())
                .startDate(request.startDate())
                .endDate(request.endDate())
                .budgetCap(request.budgetCap())
                .build();

        Trip savedTrip = tripRepository.save(trip);
        return ResponseEntity.status(HttpStatus.CREATED).body(savedTrip);
    }
}