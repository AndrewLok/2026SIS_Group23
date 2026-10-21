/*
 * Votes against the Spring backend (/api/trips/{id}/votes, /api/ideas/{id}/vote), with the same
 * signatures as services/mock/votes.ts so client.ts can swap one for the other.
 *
 * Casting or withdrawing a vote also moves the activity between tabs (the server counts the votes
 * and sets the status), so the screens read the activities again afterwards. The hooks already do.
 */

import {
  isNumber,
  isRecord,
  isString,
  readJson,
  request,
  UNEXPECTED_MESSAGE,
} from '@/services/http/request'
import { ApiError } from '@/types'
import type { Vote } from '@/types'

const unexpected = (): ApiError => new ApiError('unavailable', UNEXPECTED_MESSAGE)

function parseVote(data: unknown): Vote {
  if (
    !isRecord(data) ||
    !isString(data.ideaId) ||
    !isString(data.userId) ||
    !isNumber(data.value) ||
    (data.value !== 1 && data.value !== -1) ||
    !isString(data.createdAt)
  ) {
    throw unexpected()
  }
  return {
    ideaId: data.ideaId,
    userId: data.userId,
    value: data.value,
    createdAt: data.createdAt,
  }
}

const votePath = (ideaId: string): string => `/ideas/${encodeURIComponent(ideaId)}/vote`

export async function listForTrip(tripId: string): Promise<Vote[]> {
  const response = await request('GET', `/trips/${encodeURIComponent(tripId)}/votes`)
  const data = await readJson(response)
  if (!Array.isArray(data)) throw unexpected()
  return data.map(parseVote)
}

/** Cast or change a vote. A second vote from the same member replaces the first. */
export async function cast(ideaId: string, value: 1 | -1): Promise<void> {
  await request('PUT', votePath(ideaId), { value })
}

export async function clear(ideaId: string): Promise<void> {
  await request('DELETE', votePath(ideaId))
}
