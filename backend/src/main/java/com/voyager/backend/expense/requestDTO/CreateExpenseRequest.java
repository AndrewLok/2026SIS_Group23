package com.voyager.backend.expense.requestDTO;

/** The front end's NewExpense. split is null, or the raw JSON read by ExpenseSplit.fromWire. */
public record CreateExpenseRequest(
        String description,
        Long amountCents,
        String paidBy,
        String spentAt,
        String category,
        Object split
) {}
