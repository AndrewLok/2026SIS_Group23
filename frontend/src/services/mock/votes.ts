import { latency, read, write } from '@/services/mock/db'
import { derivedStatus } from '@/lib/voting'
import { ApiError, toVote } from '@/types'
import type { Vote } from '@/types'

/**
 * Recalculate one idea's status from its current votes.
 * Called after every cast and clear, which is what makes an idea crossing the
 * threshold move tab and appear on the calendar without a reload.
 */
function reconcileStatus(draft: ReturnType<typeof read>, ideaId: string): void {
  const idea = draft.ideas.find((i) => i.id === ideaId)
  if (!idea) return
  const memberCount = draft.tripMembers.filter((m) => m.trip_id === idea.trip_id).length
  const agree = draft.votes.filter((v) => v.idea_id === ideaId && v.value === 1).length
  idea.status = derivedStatus(
    {
      id: idea.id,
      tripId: idea.trip_id,
      title: idea.title,
      description: idea.description,
      category: idea.category,
      proposedStart: idea.proposed_start,
      proposedEnd: idea.proposed_end,
      allDay: idea.all_day,
      status: idea.status,
      proposedBy: idea.proposed_by,
      createdAt: idea.created_at,
    },
    agree,
    memberCount,
  )
}

export async function listForTrip(tripId: string): Promise<Vote[]> {
  await latency()
  const db = read()
  const ideaIds = new Set(db.ideas.filter((i) => i.trip_id === tripId).map((i) => i.id))
  return db.votes.filter((v) => ideaIds.has(v.idea_id)).map(toVote)
}

/** Cast or change a vote. A second vote from the same member overwrites the first. */
export async function cast(ideaId: string, value: 1 | -1): Promise<void> {
  await latency()
  const userId = read().sessionUserId
  if (!userId) throw new ApiError('forbidden', 'Sign in to vote.')
  write((draft) => {
    const existing = draft.votes.find((v) => v.idea_id === ideaId && v.user_id === userId)
    if (existing) {
      existing.value = value
      existing.created_at = new Date().toISOString()
    } else {
      draft.votes.push({
        idea_id: ideaId,
        user_id: userId,
        value,
        created_at: new Date().toISOString(),
      })
    }
    reconcileStatus(draft, ideaId)
  })
}

export async function clear(ideaId: string): Promise<void> {
  await latency()
  const userId = read().sessionUserId
  if (!userId) throw new ApiError('forbidden', 'Sign in to vote.')
  write((draft) => {
    draft.votes = draft.votes.filter(
      (v) => !(v.idea_id === ideaId && v.user_id === userId),
    )
    reconcileStatus(draft, ideaId)
  })
}
