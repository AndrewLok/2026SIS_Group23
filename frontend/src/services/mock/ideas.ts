import { latency, read, uid, write } from '@/services/mock/db'
import { ApiError, toIdea } from '@/types'
import type { Idea, IdeaCategory, IdeaStatus } from '@/types'

export type NewIdea = {
  tripId: string
  title: string
  description: string
  category: IdeaCategory
  proposedStart: string | null
  proposedEnd: string | null
  allDay: boolean
  /** False adds it straight to the plan; true puts it to the group. */
  needsVote: boolean
  /** Who is going. Used only when it skips the vote. */
  attendeeIds: string[]
}

export async function list(tripId: string): Promise<Idea[]> {
  await latency()
  return read()
    .ideas.filter((i) => i.trip_id === tripId)
    .map(toIdea)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export async function create(input: NewIdea): Promise<Idea> {
  await latency()
  const userId = read().sessionUserId
  if (!userId) throw new ApiError('forbidden', 'Sign in to add an activity.')
  if (!input.title.trim()) throw new ApiError('invalid', 'Give the activity a title.')
  // Without a vote there is nothing else to settle on later, so it needs a time
  // now or it could never reach the calendar.
  if (!input.needsVote && !input.proposedStart) {
    throw new ApiError('invalid', 'Pick a date and time.')
  }
  assertTimes(input.proposedStart, input.proposedEnd)
  const memberIds = new Set(
    read()
      .tripMembers.filter((m) => m.trip_id === input.tripId)
      .map((m) => m.user_id),
  )
  if (!input.needsVote && input.attendeeIds.length === 0) {
    throw new ApiError('invalid', 'Pick at least one person who is going.')
  }
  if (input.attendeeIds.some((id) => !memberIds.has(id))) {
    throw new ApiError('invalid', 'Everyone going has to be on the trip.')
  }

  const row = write((draft) => {
    const createdAt = new Date().toISOString()
    const idea = {
      id: uid(),
      trip_id: input.tripId,
      title: input.title.trim(),
      description: input.description.trim(),
      category: input.category,
      proposed_start: input.proposedStart,
      proposed_end: input.proposedEnd,
      all_day: input.allDay,
      status: (input.needsVote ? 'voting' : 'planned') as IdeaStatus,
      proposed_by: userId,
      attendee_ids: input.needsVote ? [userId] : [...new Set(input.attendeeIds)],
      created_at: createdAt,
    }
    draft.ideas.push(idea)
    if (input.needsVote) {
      // The proposer agrees with their own idea; anything else would be strange.
      draft.votes.push({
        idea_id: idea.id,
        user_id: userId,
        value: 1,
        created_at: createdAt,
      })
    }
    return idea
  })
  return toIdea(row)
}

/** An end, when there is one, has to come after the start. */
function assertTimes(start: string | null, end: string | null): void {
  if (end && !start) throw new ApiError('invalid', 'Pick when it starts too.')
  if (start && end && Date.parse(end) <= Date.parse(start)) {
    throw new ApiError('invalid', 'It has to finish after it starts.')
  }
}

export async function update(ideaId: string, patch: Partial<Idea>): Promise<Idea> {
  await latency()
  const existing = read().ideas.find((i) => i.id === ideaId)
  if (!existing) throw new ApiError('not_found', 'That activity has been deleted.')
  assertTimes(
    patch.proposedStart !== undefined ? patch.proposedStart : existing.proposed_start,
    patch.proposedEnd !== undefined ? patch.proposedEnd : existing.proposed_end,
  )
  const row = write((draft) => {
    const idea = draft.ideas.find((i) => i.id === ideaId)
    if (!idea) throw new ApiError('not_found', 'That activity has been deleted.')
    if (patch.title !== undefined) idea.title = patch.title
    if (patch.description !== undefined) idea.description = patch.description
    if (patch.category !== undefined) idea.category = patch.category
    if (patch.proposedStart !== undefined) idea.proposed_start = patch.proposedStart
    if (patch.proposedEnd !== undefined) idea.proposed_end = patch.proposedEnd
    if (patch.allDay !== undefined) idea.all_day = patch.allDay
    if (patch.attendeeIds !== undefined) idea.attendee_ids = [...new Set(patch.attendeeIds)]
    return idea
  })
  return toIdea(row)
}

/** Explicit status change, used to reject an idea or put it back to voting. */
export async function setStatus(ideaId: string, status: IdeaStatus): Promise<Idea> {
  await latency()
  const row = write((draft) => {
    const idea = draft.ideas.find((i) => i.id === ideaId)
    if (!idea) throw new ApiError('not_found', 'That activity has been deleted.')
    idea.status = status
    return idea
  })
  return toIdea(row)
}

/**
 * The signed-in member says they are in or out. Anyone can do this for
 * themselves once an activity is going ahead; while it is still being voted on,
 * the vote is how they say so.
 */
export async function setAttending(ideaId: string, attending: boolean): Promise<Idea> {
  await latency()
  const userId = read().sessionUserId
  if (!userId) throw new ApiError('forbidden', 'Sign in to join an activity.')
  const row = write((draft) => {
    const idea = draft.ideas.find((i) => i.id === ideaId)
    if (!idea) throw new ApiError('not_found', 'That activity has been deleted.')
    if (idea.status !== 'planned' && idea.status !== 'agreed') {
      throw new ApiError('invalid', 'You can join once it is going ahead.')
    }
    const others = (idea.attendee_ids ?? []).filter((id) => id !== userId)
    idea.attendee_ids = attending ? [...others, userId] : others
    return idea
  })
  return toIdea(row)
}

export async function remove(ideaId: string): Promise<void> {
  await latency()
  write((draft) => {
    draft.ideas = draft.ideas.filter((i) => i.id !== ideaId)
    draft.votes = draft.votes.filter((v) => v.idea_id !== ideaId)
  })
}
