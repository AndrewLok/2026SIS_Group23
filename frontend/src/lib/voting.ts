/*
 * The promotion rule lives here alone, so changing how an idea gets agreed is a
 * one-line edit rather than a hunt through the voting screen.
 */

import type { Idea, Vote } from '@/types'

export type Tally = {
  agree: number
  disagree: number
  agreeIds: string[]
  disagreeIds: string[]
  /** The signed-in member's own vote, when they have cast one. */
  own: 1 | -1 | null
}

/**
 * Votes needed to agree an idea: more than half of the current members.
 * Four members need three, five need three, six need four.
 */
export const agreeThreshold = (memberCount: number): number =>
  Math.floor(memberCount / 2) + 1

/** Split one idea's votes into counts and voter lists. */
export function tally(votes: Vote[], ideaId: string, currentUserId: string | null): Tally {
  const forIdea = votes.filter((v) => v.ideaId === ideaId)
  const agreeIds = forIdea.filter((v) => v.value === 1).map((v) => v.userId)
  const disagreeIds = forIdea.filter((v) => v.value === -1).map((v) => v.userId)
  const own = currentUserId
    ? (forIdea.find((v) => v.userId === currentUserId)?.value ?? null)
    : null
  return {
    agree: agreeIds.length,
    disagree: disagreeIds.length,
    agreeIds,
    disagreeIds,
    own,
  }
}

/** Has this idea earned promotion to the calendar? */
export const hasReachedThreshold = (agreeCount: number, memberCount: number): boolean =>
  memberCount > 0 && agreeCount >= agreeThreshold(memberCount)

/**
 * The status an idea should hold given its current votes. Called after every
 * vote so an idea crossing the line moves tab without anyone reloading.
 * Only ever promotes to agreed or demotes back to voting; a rejection is a
 * deliberate act by the owner or proposer, never a vote count.
 */
export function derivedStatus(
  idea: Idea,
  agreeCount: number,
  memberCount: number,
): Idea['status'] {
  if (idea.status === 'rejected') return 'rejected'
  return hasReachedThreshold(agreeCount, memberCount) ? 'agreed' : 'voting'
}

/** An agreed idea with no date cannot be placed on the calendar yet. */
export const needsADate = (idea: Idea): boolean =>
  idea.status === 'agreed' && idea.proposedStart === null
