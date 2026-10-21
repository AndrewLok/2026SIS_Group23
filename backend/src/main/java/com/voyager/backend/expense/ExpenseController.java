package com.voyager.backend.expense;

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
import com.voyager.backend.expense.requestDTO.CreateExpenseRequest;
import com.voyager.backend.expense.responseDTO.BalancesResponse;
import com.voyager.backend.expense.responseDTO.ExpenseResponse;

import jakarta.servlet.http.HttpSession;

@RestController
@RequestMapping("/api")
public class ExpenseController {

    private final ExpenseService expenseService;

    public ExpenseController(ExpenseService expenseService) {
        this.expenseService = expenseService;
    }

    @GetMapping("/trips/{tripId}/expenses")
    public List<ExpenseResponse> list(HttpSession session, @PathVariable String tripId) {
        return expenseService.list(Session.require(session), tripId);
    }

    @PostMapping("/trips/{tripId}/expenses")
    public ResponseEntity<ExpenseResponse> create(HttpSession session, @PathVariable String tripId,
                                                  @RequestBody CreateExpenseRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(expenseService.create(Session.require(session), tripId, request));
    }

    @PatchMapping("/expenses/{expenseId}")
    public ExpenseResponse update(HttpSession session, @PathVariable String expenseId,
                                  @RequestBody Map<String, Object> patch) {
        return expenseService.update(Session.require(session), expenseId, new Patch(patch));
    }

    @DeleteMapping("/expenses/{expenseId}")
    public ResponseEntity<Void> delete(HttpSession session, @PathVariable String expenseId) {
        expenseService.delete(Session.require(session), expenseId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/trips/{tripId}/expenses/balances")
    public BalancesResponse balances(HttpSession session, @PathVariable String tripId) {
        return expenseService.balances(Session.require(session), tripId);
    }
}
