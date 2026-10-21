package com.voyager.backend.idea;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface VoteRepository extends JpaRepository<Vote, String> {
    List<Vote> findByIdeaId(String ideaId);
    List<Vote> findByIdeaIdIn(Collection<String> ideaIds);
    Optional<Vote> findByIdeaIdAndUserId(String ideaId, String userId);
    void deleteByIdeaId(String ideaId);
}
