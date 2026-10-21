package com.voyager.backend.expense.responseDTO;

import java.util.Map;

import com.voyager.backend.common.Times;
import com.voyager.backend.expense.Expense;
import com.voyager.backend.expense.ExpenseSplit;

/** Matches the front end's Expense type. Ids are strings, dates ISO-8601 UTC. */
public record ExpenseResponse(
        String id,
        String tripId,
        String description,
        long amountCents,
        String paidBy,
        String spentAt,
        String category,
        String source,
        String sourceId,
        Map<String, Object> split
) {
    public static ExpenseResponse from(Expense expense) {
        ExpenseSplit split = expense.getSplit();
        return new ExpenseResponse(
                expense.getId(),
                expense.getTripId(),
                expense.getDescription(),
                expense.getAmountCents(),
                expense.getPaidBy(),
                Times.iso(expense.getSpentAt()),
                expense.getCategory().wireName(),
                expense.getSource(),
                expense.getSourceId(),
                split == null ? null : split.toWire());
    }
}
