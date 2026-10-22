package com.voyager.backend.expenses.responsedto;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import com.voyager.backend.expenses.ExpenseService.ExpenseDetail;
import com.voyager.backend.expenses.ExpenseShare;
import com.voyager.backend.expenses.SplitKind;

// The frontend's Expense type, field for field, plus who added it (so the screen knows whether to
// offer Delete). category and source are the lower-case words. split is null for "everyone, evenly",
// otherwise one of the two shapes below.

public record ExpenseResponse(
    UUID id,
    UUID tripId,
    String description,
    long amountCents,
    UUID paidBy,
    Instant spentAt,
    String category,
    String source,
    String sourceId,
    SplitResponse split,
    UUID createdBy,
    Instant createdAt
) {

    public sealed interface SplitResponse permits EqualSplit, ExactSplit {}

    public record EqualSplit(String kind, List<UUID> userIds) implements SplitResponse {}

    public record ExactSplit(String kind, Map<UUID, Long> amounts) implements SplitResponse {}

    public static ExpenseResponse from(ExpenseDetail detail) {
        var e = detail.expense();
        return new ExpenseResponse(
            e.getId(),
            e.getTripId(),
            e.getDescription(),
            e.getAmountCents(),
            e.getPaidBy(),
            e.getSpentAt(),
            e.getCategory().wire(),
            e.getSource().wire(),
            e.getSourceId(),
            splitOf(e.getSplitKind(), detail.shares()),
            e.getCreatedBy(),
            e.getCreatedAt()
        );
    }

    private static SplitResponse splitOf(SplitKind kind, List<ExpenseShare> rows) {
        if (kind == null) {
            return null;
        }
        if (kind == SplitKind.EQUAL) {
            return new EqualSplit(kind.wire(), rows.stream().map(ExpenseShare::getUserId).toList());
        }
        Map<UUID, Long> amounts = new LinkedHashMap<>();
        for (ExpenseShare row : rows) {
            amounts.put(row.getUserId(), row.getCents());
        }
        return new ExactSplit(kind.wire(), amounts);
    }
}
