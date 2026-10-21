package com.voyager.backend.idea;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

public interface IdeaRepository extends JpaRepository<Idea, String> {
    List<Idea> findByTripIdOrderByCreatedAtDesc(String tripId);
}
