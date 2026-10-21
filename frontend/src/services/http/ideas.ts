import { request, seg } from '@/services/http/request'
import type { NewIdea } from '@/services/mock/ideas'
import type { Idea, IdeaStatus, Vote } from '@/types'

export const list = (tripId: string): Promise<Idea[]> => request('GET', `/trips/${seg(tripId)}/ideas`)

export const create = ({ tripId, ...input }: NewIdea): Promise<Idea> =>
  request('POST', `/trips/${seg(tripId)}/ideas`, input)

export const update = (ideaId: string, patch: Partial<Idea>): Promise<Idea> =>
  request('PATCH', `/ideas/${seg(ideaId)}`, patch)

/** Explicit status change, used to reject an idea or put it back to voting. */
export const setStatus = (ideaId: string, status: IdeaStatus): Promise<Idea> =>
  request('POST', `/ideas/${seg(ideaId)}/status`, { status })

export const setAttending = (ideaId: string, attending: boolean): Promise<Idea> =>
  request('POST', `/ideas/${seg(ideaId)}/attending`, { attending })

export const remove = (ideaId: string): Promise<void> => request('DELETE', `/ideas/${seg(ideaId)}`)

/* Votes. The server recalculates the idea's status after each one. */

export const listVotes = (tripId: string): Promise<Vote[]> => request('GET', `/trips/${seg(tripId)}/votes`)

/** Cast or change a vote. A second vote from the same member overwrites the first. */
export const cast = (ideaId: string, value: 1 | -1): Promise<void> =>
  request('PUT', `/ideas/${seg(ideaId)}/vote`, { value })

export const clear = (ideaId: string): Promise<void> => request('DELETE', `/ideas/${seg(ideaId)}/vote`)
