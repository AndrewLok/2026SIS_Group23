package com.voyager.backend.fuel;

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

import com.voyager.backend.fuel.responsedto.FuelLegResponse;
import com.voyager.backend.security.CurrentUser;

// Every endpoint here needs a signed-in user (see SecurityConfig). The rules about who may do what
// are in FuelService; this class only translates HTTP to and from it. The request bodies are
// plain maps on purpose, see FuelService.create.

@RestController
@RequestMapping("/api")
public class FuelController {

    private final FuelService service;

    public FuelController(FuelService service) {
        this.service = service;
    }

    @GetMapping("/trips/{tripId}/fuel-legs")
    public ResponseEntity<List<FuelLegResponse>> list(@PathVariable UUID tripId, Authentication authentication) {
        List<FuelLegResponse> body = service.list(tripId, CurrentUser.id(authentication)).stream()
                .map(FuelLegResponse::from)
                .toList();
        return ResponseEntity.ok(body);
    }

    // { label, distanceKm, efficiencyL100km, pricePerLitreCents, driverId, riderIds }. See FuelService.
    @PostMapping("/trips/{tripId}/fuel-legs")
    public ResponseEntity<FuelLegResponse> create(@PathVariable UUID tripId, @RequestBody Map<String, Object> body,
            Authentication authentication) {
        var created = service.create(tripId, CurrentUser.id(authentication), body);
        return ResponseEntity.status(HttpStatus.CREATED).body(FuelLegResponse.from(created));
    }

    // Partial update: send only the fields to change. See FuelService.update.
    @PatchMapping("/fuel-legs/{legId}")
    public ResponseEntity<FuelLegResponse> update(@PathVariable UUID legId, @RequestBody Map<String, Object> patch,
            Authentication authentication) {
        return ResponseEntity.ok(FuelLegResponse.from(service.update(legId, CurrentUser.id(authentication), patch)));
    }

    @DeleteMapping("/fuel-legs/{legId}")
    public ResponseEntity<Void> remove(@PathVariable UUID legId, Authentication authentication) {
        service.remove(legId, CurrentUser.id(authentication));
        return ResponseEntity.noContent().build();
    }
}
