package com.voyager.backend.expense;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import com.voyager.backend.common.Ids;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.MapKeyColumn;
import jakarta.persistence.OrderColumn;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

/**
 * Money someone paid for the group.
 *
 * How it is shared, as in the front end's ExpenseSplit:
 *   no split   everyone on the trip right now, evenly.
 *   equal      evenly across the named members.
 *   exact      what each named member owes the payer; the rest is the payer's own share.
 * A fuel expense ignores all three and is shared by its leg's riders.
 */
@Entity
@Table(name = "expenses", indexes = @Index(name = "idx_expenses_trip_id", columnList = "trip_id"))
public class Expense {

    public static final String MANUAL = "manual";
    public static final String FUEL = "fuel";
    public static final String SPLIT_EQUAL = "equal";
    public static final String SPLIT_EXACT = "exact";

    @Id
    private String id;

    @Column(name = "trip_id", nullable = false)
    private String tripId;

    @Column(nullable = false, length = 500)
    private String description;

    @Column(nullable = false)
    private long amountCents; // Integer cents, always above zero.

    @Column(nullable = false)
    private String paidBy; // A user id.

    @Column(nullable = false)
    private Instant spentAt;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ExpenseCategory category;

    @Column(nullable = false)
    private String source; // "manual", or "fuel" when a fuel leg wrote it.

    private String sourceId; // The fuel leg id when source is "fuel".

    private String splitKind; // null, "equal" or "exact".

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "expense_split_users", joinColumns = @JoinColumn(name = "expense_id"))
    @OrderColumn(name = "position")
    @Column(name = "user_id", nullable = false)
    private List<String> splitUserIds = new ArrayList<>(); // For an equal split.

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "expense_split_amounts", joinColumns = @JoinColumn(name = "expense_id"))
    @MapKeyColumn(name = "user_id")
    @Column(name = "amount_cents", nullable = false)
    private Map<String, Long> splitAmounts = new LinkedHashMap<>(); // For an exact split.

    private Instant createdAt;

    public Expense() {}

    public Expense(String id, String tripId, String description, long amountCents, String paidBy, Instant spentAt,
                   ExpenseCategory category, String source, String sourceId) {
        this.id = id == null ? Ids.newId() : id;
        this.tripId = tripId;
        this.description = description;
        this.amountCents = amountCents;
        this.paidBy = paidBy;
        this.spentAt = spentAt;
        this.category = category;
        this.source = source;
        this.sourceId = sourceId;
    }

    @PrePersist
    void onCreate() {
        if (createdAt == null) createdAt = Instant.now();
    }

    public String getId() { return id; }
    public String getTripId() { return tripId; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public long getAmountCents() { return amountCents; }
    public void setAmountCents(long amountCents) { this.amountCents = amountCents; }
    public String getPaidBy() { return paidBy; }
    public void setPaidBy(String paidBy) { this.paidBy = paidBy; }
    public Instant getSpentAt() { return spentAt; }
    public void setSpentAt(Instant spentAt) { this.spentAt = spentAt; }
    public ExpenseCategory getCategory() { return category; }
    public void setCategory(ExpenseCategory category) { this.category = category; }
    public String getSource() { return source; }
    public String getSourceId() { return sourceId; }
    public Instant getCreatedAt() { return createdAt; }
    public boolean isFuel() { return FUEL.equals(source); }

    public ExpenseSplit getSplit() {
        if (SPLIT_EQUAL.equals(splitKind)) return ExpenseSplit.equal(splitUserIds);
        if (SPLIT_EXACT.equals(splitKind)) return ExpenseSplit.exact(splitAmounts);
        return null;
    }

    public void setSplit(ExpenseSplit split) {
        splitUserIds.clear();
        splitAmounts.clear();
        if (split == null) {
            splitKind = null;
        } else if (split.isEqual()) {
            splitKind = SPLIT_EQUAL;
            splitUserIds.addAll(split.userIds());
        } else {
            splitKind = SPLIT_EXACT;
            splitAmounts.putAll(split.amounts());
        }
    }
}
