package com.voyager.backend.expenses;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ExpenseShareRepository extends JpaRepository<ExpenseShare, UUID> {
    List<ExpenseShare> findByExpenseId(UUID expenseId);
    List<ExpenseShare> findByExpenseIdIn(Collection<UUID> expenseIds);
    void deleteByExpenseId(UUID expenseId);
}
