package com.voyager.backend.expenses;

import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

// One person named in an expense's split. For an EQUAL split that is all there is (cents is null);
// for an EXACT split it is what that person owes the payer. Kept as a plain user id: someone named
// here who later leaves the trip still owes their part.

@Entity
@Table(name = "expense_shares",
        uniqueConstraints = @UniqueConstraint(columnNames = {"expense_id", "user_id"}))
public class ExpenseShare {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "expense_id", nullable = false)
    private UUID expenseId;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    private Long cents;

    public ExpenseShare() {}

    public ExpenseShare(UUID expenseId, UUID userId, Long cents) {
        this.expenseId = expenseId;
        this.userId = userId;
        this.cents = cents;
    }

    public UUID getId() { return id; }
    public UUID getExpenseId() { return expenseId; }
    public UUID getUserId() { return userId; }
    public Long getCents() { return cents; }
}
