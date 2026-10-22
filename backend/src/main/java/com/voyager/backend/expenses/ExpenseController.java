package com.voyager.backend.expenses;

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

import com.voyager.backend.expenses.responsedto.ExpenseResponse;
import com.voyager.backend.security.CurrentUser;

// Every endpoint here needs a signed-in user (see SecurityConfig). The rules about who may do what
// are in ExpenseService; this class only translates HTTP to and from it. The request bodies are
// plain maps on purpose, see ExpenseService.create.

@RestController
@RequestMapping("/api")
public class ExpenseController {

    private final ExpenseService service;

    public ExpenseController(ExpenseService service) {
        this.service = service;
    }

    @GetMapping("/trips/{tripId}/expenses")
    public ResponseEntity<List<ExpenseResponse>> list(@PathVariable UUID tripId, Authentication authentication) {
        List<ExpenseResponse> body = service.list(tripId, CurrentUser.id(authentication)).stream()
                .map(ExpenseResponse::from)
                .toList();
        return ResponseEntity.ok(body);
    }

    // { description, amountCents, paidBy, spentAt, category, split? }. See ExpenseService.
    @PostMapping("/trips/{tripId}/expenses")
    public ResponseEntity<ExpenseResponse> create(@PathVariable UUID tripId, @RequestBody Map<String, Object> body,
            Authentication authentication) {
        var created = service.create(tripId, CurrentUser.id(authentication), body);
        return ResponseEntity.status(HttpStatus.CREATED).body(ExpenseResponse.from(created));
    }

    // Partial update: send only the fields to change. See ExpenseService.update.
    @PatchMapping("/expenses/{expenseId}")
    public ResponseEntity<ExpenseResponse> update(@PathVariable UUID expenseId, @RequestBody Map<String, Object> patch,
            Authentication authentication) {
        return ResponseEntity.ok(ExpenseResponse.from(service.update(expenseId, CurrentUser.id(authentication), patch)));
    }

    @DeleteMapping("/expenses/{expenseId}")
    public ResponseEntity<Void> remove(@PathVariable UUID expenseId, Authentication authentication) {
        service.remove(expenseId, CurrentUser.id(authentication));
        return ResponseEntity.noContent().build();
    }
}
