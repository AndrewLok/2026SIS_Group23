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
  if (!userId) throw new ApiError('forbidden', 'Sign in to propose an idea.')
  if (!input.title.trim()) throw new ApiError('invalid', 'Give the idea a title.')
  const row = write((draft) => {
    const idea = {
      id: uid(),
      trip_id: input.tripId,
      title: input.title.trim(),
      description: input.description.trim(),
      category: input.category,
      proposed_start: input.proposedStart,
      proposed_end: input.proposedEnd,
      all_day: input.allDay,
      status: 'voting' as IdeaStatus,
      proposed_by: userId,
      created_at: new Date().toISOString(),
    }
    draft.ideas.push(idea)
    // The proposer agrees with their own idea; anything else would be strange.
    draft.votes.push({
      idea_id: idea.id,
      user_id: userId,
      value: 1,
      created_at: idea.created_at,
    })
    return idea
  })
  return toIdea(row)
}

export async function update(ideaId: string, patch: Partial<Idea>): Promise<Idea> {
  await latency()
  const row = write((draft) => {
    const idea = draft.ideas.find((i) => i.id === ideaId)
    if (!idea) throw new ApiError('not_found', 'That idea has been deleted.')
    if (patch.title !== undefined) idea.title = patch.title
    if (patch.description !== undefined) idea.description = patch.description
    if (patch.category !== undefined) idea.category = patch.category
    if (patch.proposedStart !== undefined) idea.proposed_start = patch.proposedStart
    if (patch.proposedEnd !== undefined) idea.proposed_end = patch.proposedEnd
    if (patch.allDay !== undefined) idea.all_day = patch.allDay
    return idea
  })
  return toIdea(row)
}

/** Explicit status change, used to reject an idea or put it back to voting. */
export async function setStatus(ideaId: string, status: IdeaStatus): Promise<Idea> {
  await latency()
  const row = write((draft) => {
    const idea = draft.ideas.find((i) => i.id === ideaId)
    if (!idea) throw new ApiError('not_found', 'That idea has been deleted.')
    idea.status = status
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
