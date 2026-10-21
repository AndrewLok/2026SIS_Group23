package com.voyager.backend.activities;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

public interface IdeaAttendeeRepository extends JpaRepository<IdeaAttendee, UUID> {
    List<IdeaAttendee> findByIdeaId(UUID ideaId);
    List<IdeaAttendee> findByIdeaIdIn(Collection<UUID> ideaIds);
    Optional<IdeaAttendee> findByIdeaIdAndUserId(UUID ideaId, UUID userId);
    void deleteByIdeaId(UUID ideaId);
}
