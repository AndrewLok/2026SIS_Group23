package com.voyager.backend.expense;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ExpenseRepository extends JpaRepository<Expense, String> {
    List<Expense> findByTripIdOrderBySpentAtDescCreatedAtDesc(String tripId);
    Optional<Expense> findBySourceAndSourceId(String source, String sourceId);
}
