package com.voyager.backend.expenses;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ExpenseRepository extends JpaRepository<Expense, UUID> {
    List<Expense> findByTripId(UUID tripId);

    // The expense a fuel leg wrote, by the leg's id.
    Optional<Expense> findBySourceAndSourceId(ExpenseSource source, String sourceId);

    // Just the trip an expense belongs to, without loading it, so ExpenseService can lock the trip
    // before it reads the expense (the same reason as IdeaRepository.findTripIdById).
    @Query("select e.tripId from Expense e where e.id = :id")
    Optional<UUID> findTripIdById(@Param("id") UUID id);
}
