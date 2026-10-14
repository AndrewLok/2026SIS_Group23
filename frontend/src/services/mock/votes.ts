import { latency, read, write } from '@/services/mock/db'
import { derivedStatus } from '@/lib/voting'
import { ApiError, toIdea, toVote } from '@/types'
import type { Vote } from '@/types'

/**
 * Recalculate one idea's status from its current votes.
 * Called after every cast and clear, which is what makes an idea crossing the
 * threshold move tab and appear on the calendar without a reload.
 *
 * The moment a vote passes, everyone who voted for it is marked as going.
 * After that, attendance is each member's own call.
 */
function reconcileStatus(draft: ReturnType<typeof read>, ideaId: string): void {
  const idea = draft.ideas.find((i) => i.id === ideaId)
  if (!idea) return
  const memberCount = draft.tripMembers.filter((m) => m.trip_id === idea.trip_id).length
  const agreeIds = draft.votes
    .filter((v) => v.idea_id === ideaId && v.value === 1)
    .map((v) => v.user_id)
  const before = idea.status
  idea.status = derivedStatus(toIdea(idea), agreeIds.length, memberCount)
  if (before === 'voting' && idea.status === 'agreed') {
    idea.attendee_ids = [...new Set([...(idea.attendee_ids ?? []), ...agreeIds])]
  }
}

/** Votes only make sense on something that was put to the group. */
function assertVotable(ideaId: string): void {
  const idea = read().ideas.find((i) => i.id === ideaId)
  if (!idea) throw new ApiError('not_found', 'That activity has been deleted.')
  if (idea.status === 'planned') {
    throw new ApiError('invalid', 'This one was added without a vote.')
  }
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
  assertVotable(ideaId)
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
  assertVotable(ideaId)
  write((draft) => {
    draft.votes = draft.votes.filter(
      (v) => !(v.idea_id === ideaId && v.user_id === userId),
    )
    reconcileStatus(draft, ideaId)
  })
}
