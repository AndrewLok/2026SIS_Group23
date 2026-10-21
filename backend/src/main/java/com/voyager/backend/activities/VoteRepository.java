package com.voyager.backend.activities;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

public interface VoteRepository extends JpaRepository<Vote, UUID> {
    List<Vote> findByIdeaId(UUID ideaId);
    List<Vote> findByIdeaIdIn(Collection<UUID> ideaIds);
    Optional<Vote> findByIdeaIdAndUserId(UUID ideaId, UUID userId);
    void deleteByIdeaId(UUID ideaId);
}
