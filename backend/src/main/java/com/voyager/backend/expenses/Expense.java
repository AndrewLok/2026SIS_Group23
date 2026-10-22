package com.voyager.backend.expenses;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;

// Money somebody spent for the trip. The frontend's Expense, plus who typed it in. Who owes what is
// worked out from the amount, the payer and the split (see ExpenseShare); balances themselves are
// worked out by the frontend from all of a trip's expenses, and nothing about them is stored.

@Entity
@Table(name = "expenses", indexes = @Index(columnList = "trip_id"))
public class Expense {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "trip_id", nullable = false)
    private UUID tripId;

    @Column(nullable = false, length = 100) // Limits.EXPENSE_DESCRIPTION
    private String description;

    // Whole cents, above zero.
    @Column(nullable = false)
    private long amountCents;

    // A plain id. The service makes sure it is someone on the trip when the expense is made or
    // changed; if they leave afterwards the expense stays, because they are still owed the money.
    @Column(name = "paid_by", nullable = false)
    private UUID paidBy;

    @Column(nullable = false)
    private Instant spentAt;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ExpenseCategory category;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ExpenseSource source;

    // The fuel leg's id when source is FUEL, otherwise null.
    @Column(name = "source_id", length = 64)
    private String sourceId;

    // Null means "everyone on the trip, evenly". Otherwise the people are the ExpenseShare rows.
    @Enumerated(EnumType.STRING)
    private SplitKind splitKind;

    // A plain id: if the person who typed it in leaves the trip, the expense stays.
    @Column(name = "created_by", nullable = false)
    private UUID createdBy;

    @Column(nullable = false)
    private Instant createdAt;

    public Expense() {}

    public Expense(UUID tripId, String description, long amountCents, UUID paidBy, Instant spentAt,
            ExpenseCategory category, ExpenseSource source, String sourceId, SplitKind splitKind,
            UUID createdBy, Instant createdAt) {
        this.tripId = tripId;
        this.description = description;
        this.amountCents = amountCents;
        this.paidBy = paidBy;
        this.spentAt = spentAt;
        this.category = category;
        this.source = source;
        this.sourceId = sourceId;
        this.splitKind = splitKind;
        this.createdBy = createdBy;
        this.createdAt = createdAt;
    }

    public UUID getId() { return id; }
    public UUID getTripId() { return tripId; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public long getAmountCents() { return amountCents; }
    public void setAmountCents(long amountCents) { this.amountCents = amountCents; }
    public UUID getPaidBy() { return paidBy; }
    public void setPaidBy(UUID paidBy) { this.paidBy = paidBy; }
    public Instant getSpentAt() { return spentAt; }
    public void setSpentAt(Instant spentAt) { this.spentAt = spentAt; }
    public ExpenseCategory getCategory() { return category; }
    public void setCategory(ExpenseCategory category) { this.category = category; }
    public ExpenseSource getSource() { return source; }
    public String getSourceId() { return sourceId; }
    public SplitKind getSplitKind() { return splitKind; }
    public void setSplitKind(SplitKind splitKind) { this.splitKind = splitKind; }
    public UUID getCreatedBy() { return createdBy; }
    public Instant getCreatedAt() { return createdAt; }
}
