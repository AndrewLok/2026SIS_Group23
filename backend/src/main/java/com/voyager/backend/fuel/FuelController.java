package com.voyager.backend.fuel;

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
import com.voyager.backend.fuel.requestDTO.CreateFuelLegRequest;
import com.voyager.backend.fuel.responseDTO.FuelLegResponse;

import jakarta.servlet.http.HttpSession;

@RestController
@RequestMapping("/api")
public class FuelController {

    private final FuelService fuelService;

    public FuelController(FuelService fuelService) {
        this.fuelService = fuelService;
    }

    @GetMapping("/trips/{tripId}/fuel")
    public List<FuelLegResponse> list(HttpSession session, @PathVariable String tripId) {
        return fuelService.list(Session.require(session), tripId);
    }

    @PostMapping("/trips/{tripId}/fuel")
    public ResponseEntity<FuelLegResponse> create(HttpSession session, @PathVariable String tripId,
                                                  @RequestBody CreateFuelLegRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(fuelService.create(Session.require(session), tripId, request));
    }

    @PatchMapping("/fuel/{legId}")
    public FuelLegResponse update(HttpSession session, @PathVariable String legId,
                                  @RequestBody Map<String, Object> patch) {
        return fuelService.update(Session.require(session), legId, new Patch(patch));
    }

    @DeleteMapping("/fuel/{legId}")
    public ResponseEntity<Void> remove(HttpSession session, @PathVariable String legId) {
        fuelService.remove(Session.require(session), legId);
        return ResponseEntity.noContent().build();
    }
}
