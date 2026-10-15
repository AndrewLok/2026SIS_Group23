package com.voyager.backend.user;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface VoteRepository extends JpaRepository<Vote, UUID> {
    List<Vote> findByActivityId(UUID activityId);
    boolean existsByUserIdAndActivityId(UUID userId, UUID activityId);
}