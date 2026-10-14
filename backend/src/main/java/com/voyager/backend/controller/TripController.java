package com.voyager.backend.controller;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
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

    public TripController(TripRepository tripRepository) {
        this.tripRepository = tripRepository;
    }

    @GetMapping
    public ResponseEntity<List<Trip>> getAllTrips() {
        return ResponseEntity.ok(tripRepository.findAll());
    }

    @PostMapping
    public ResponseEntity<Trip> createTrip(@RequestBody CreateTripRequest request) {
        String randomCode = Long.toHexString(Double.doubleToLongBits(Math.random())).substring(0, 6).toUpperCase();

        Trip trip = new Trip(
                request.destination(),
                request.startDate(),
                request.endDate(),
                request.budgetCap(),
                randomCode
        );

        Trip savedTrip = tripRepository.save(trip);
        return ResponseEntity.status(HttpStatus.CREATED).body(savedTrip);
    }

    @PostMapping("/join/{code}")
    public ResponseEntity<?> joinTripByCode(@PathVariable String code) {
        return tripRepository.findByJoinCode(code.toUpperCase())
                .map(trip -> ResponseEntity.ok("Successfully joined trip to " + trip.getDestination()))
                .orElse(ResponseEntity.status(HttpStatus.NOT_FOUND).body("Invalid join code"));
    }
}