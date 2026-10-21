import { request, seg } from '@/services/http/request'
import type { NewTrip } from '@/services/mock/trips'
import type { Profile, Role, Trip, TripMember } from '@/types'

export const list = (): Promise<Trip[]> => request('GET', '/trips')

export const get = (tripId: string): Promise<Trip> => request('GET', `/trips/${seg(tripId)}`)

export const create = (input: NewTrip): Promise<Trip> => request('POST', '/trips', input)

export const update = (tripId: string, patch: Partial<Trip>): Promise<Trip> =>
  request('PATCH', `/trips/${seg(tripId)}`, patch)

/** Look up a trip by invite code without joining it, for the join preview. */
export const previewByCode = (code: string): Promise<{ trip: Trip; members: Profile[] }> =>
  request('GET', `/invites/${seg(code.trim())}`)

export const joinByCode = (code: string): Promise<Trip> =>
  request('POST', `/invites/${seg(code.trim())}/join`)

export const regenerateCode = (tripId: string): Promise<Trip> =>
  request('POST', `/trips/${seg(tripId)}/invite-code`)

/* Members */

export const listMembers = (tripId: string): Promise<(TripMember & { profile: Profile })[]> =>
  request('GET', `/trips/${seg(tripId)}/members`)

export const removeMember = (tripId: string, userId: string): Promise<void> =>
  request('DELETE', `/trips/${seg(tripId)}/members/${seg(userId)}`)

export const updateRole = (tripId: string, userId: string, role: Role): Promise<void> =>
  request('PATCH', `/trips/${seg(tripId)}/members/${seg(userId)}`, { role })
