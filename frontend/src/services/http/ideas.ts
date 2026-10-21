/*
 * Activities (the app's "ideas") against the Spring backend (/api/trips/{id}/ideas, /api/ideas/*),
 * with the same signatures as services/mock/ideas.ts so client.ts can swap one for the other.
 *
 * Who may do what is decided on the server (the person who added it or the trip owner can change or
 * delete it; anyone on the trip can say they are in or out), and so is the status: it follows the
 * votes, which is why nothing here works it out.
 */

import {
  isRecord,
  isString,
  isStringOrNull,
  readJson,
  request,
  UNEXPECTED_MESSAGE,
} from '@/services/http/request'
import type { NewIdea } from '@/services/mock/ideas'
import { ApiError } from '@/types'
import type { Idea, IdeaCategory, IdeaStatus } from '@/types'

const unexpected = (): ApiError => new ApiError('unavailable', UNEXPECTED_MESSAGE)

const CATEGORIES: ReadonlyArray<string> = ['activity', 'food', 'stay', 'travel']
const STATUSES: ReadonlyArray<string> = ['planned', 'voting', 'agreed', 'rejected']

function parseIdea(data: unknown): Idea {
  if (
    !isRecord(data) ||
    !isString(data.id) ||
    !isString(data.tripId) ||
    !isString(data.title) ||
    !isString(data.description) ||
    !isString(data.category) ||
    !CATEGORIES.includes(data.category) ||
    !isStringOrNull(data.proposedStart) ||
    !isStringOrNull(data.proposedEnd) ||
    typeof data.allDay !== 'boolean' ||
    !isString(data.status) ||
    !STATUSES.includes(data.status) ||
    !isString(data.proposedBy) ||
    !Array.isArray(data.attendeeIds) ||
    !data.attendeeIds.every(isString) ||
    !isString(data.createdAt)
  ) {
    throw unexpected()
  }
  return {
    id: data.id,
    tripId: data.tripId,
    title: data.title,
    description: data.description,
    category: data.category as IdeaCategory,
    proposedStart: data.proposedStart,
    proposedEnd: data.proposedEnd,
    allDay: data.allDay,
    status: data.status as IdeaStatus,
    proposedBy: data.proposedBy,
    attendeeIds: [...(data.attendeeIds as string[])],
    createdAt: data.createdAt,
  }
}

const ideaPath = (ideaId: string): string => `/ideas/${encodeURIComponent(ideaId)}`

/** Newest first. */
export async function list(tripId: string): Promise<Idea[]> {
  const response = await request('GET', `/trips/${encodeURIComponent(tripId)}/ideas`)
  const data = await readJson(response)
  if (!Array.isArray(data)) throw unexpected()
  return data.map(parseIdea)
}

export async function create(input: NewIdea): Promise<Idea> {
  const response = await request('POST', `/trips/${encodeURIComponent(input.tripId)}/ideas`, {
    title: input.title,
    description: input.description,
    category: input.category,
    proposedStart: input.proposedStart,
    proposedEnd: input.proposedEnd,
    allDay: input.allDay,
    needsVote: input.needsVote,
    attendeeIds: input.attendeeIds,
  })
  return parseIdea(await readJson(response))
}

/**
 * Only these can be changed this way. The status is the votes' to change (or setStatus's), and who
 * added it and when are fixed, so they are left out of the request even if the patch carries them.
 */
export async function update(ideaId: string, patch: Partial<Idea>): Promise<Idea> {
  const body = {
    title: patch.title,
    description: patch.description,
    category: patch.category,
    proposedStart: patch.proposedStart,
    proposedEnd: patch.proposedEnd,
    allDay: patch.allDay,
    attendeeIds: patch.attendeeIds,
  }
  // JSON leaves out what is undefined and keeps what is null, which is the difference between
  // "leave it alone" and "clear it" that the server relies on.
  const response = await request('PATCH', ideaPath(ideaId), body)
  return parseIdea(await readJson(response))
}

/** Rule an activity out ('rejected') or put it back to the group ('voting'). */
export async function setStatus(ideaId: string, status: IdeaStatus): Promise<Idea> {
  const response = await request('PUT', `${ideaPath(ideaId)}/status`, { status })
  return parseIdea(await readJson(response))
}

/** The signed-in member says they are in or out of something that is going ahead. */
export async function setAttending(ideaId: string, attending: boolean): Promise<Idea> {
  const response = await request('PUT', `${ideaPath(ideaId)}/attendance`, { attending })
  return parseIdea(await readJson(response))
}

export async function remove(ideaId: string): Promise<void> {
  await request('DELETE', ideaPath(ideaId))
}
