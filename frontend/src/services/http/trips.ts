/*
 * Trips and their members against the Spring backend (/api/trips/*), with the same signatures as
 * the trip functions in services/mock/trips.ts so client.ts can swap one for the other.
 *
 * The backend answers in the shape of the types here (camelCase, ISO date strings, money in cents),
 * so responses are checked rather than converted.
 */

import {
  isNumber,
  isRecord,
  isString,
  isStringOrNull,
  readJson,
  request,
  UNEXPECTED_MESSAGE,
} from '@/services/http/request'
import { ApiError } from '@/types'
import type { Profile, Role, Trip, TripMember, TripPreview } from '@/types'

export type NewTrip = {
  name: string
  destination: string
  startDate: string | null
  endDate: string | null
}

/* Reading responses */

const unexpected = (): ApiError => new ApiError('unavailable', UNEXPECTED_MESSAGE)

function parseTripPreview(data: unknown): TripPreview {
  if (
    !isRecord(data) ||
    !isString(data.id) ||
    !isString(data.name) ||
    !isString(data.destination) ||
    !isStringOrNull(data.startDate) ||
    !isStringOrNull(data.endDate)
  ) {
    throw unexpected()
  }
  return {
    id: data.id,
    name: data.name,
    destination: data.destination,
    startDate: data.startDate,
    endDate: data.endDate,
  }
}

function parseTrip(data: unknown): Trip {
  if (
    !isRecord(data) ||
    !isString(data.inviteCode) ||
    !isString(data.createdBy) ||
    !isString(data.currency) ||
    !isNumber(data.coverHue) ||
    !isNumber(data.allowanceCents) ||
    !isNumber(data.defaultEfficiency) ||
    !isNumber(data.defaultPricePerLitreCents) ||
    typeof data.privateDebts !== 'boolean' ||
    !(data.budgetCapCents === null || isNumber(data.budgetCapCents))
  ) {
    throw unexpected()
  }
  return {
    ...parseTripPreview(data),
    inviteCode: data.inviteCode,
    createdBy: data.createdBy,
    currency: data.currency,
    coverHue: data.coverHue,
    allowanceCents: data.allowanceCents,
    defaultEfficiency: data.defaultEfficiency,
    defaultPricePerLitreCents: data.defaultPricePerLitreCents,
    privateDebts: data.privateDebts,
    budgetCapCents: data.budgetCapCents,
  }
}

/** Other people come without an email address, so theirs is empty here. */
function parseProfile(data: unknown): Profile {
  if (!isRecord(data) || !isString(data.id) || !isString(data.displayName) || !isNumber(data.avatarHue)) {
    throw unexpected()
  }
  return { id: data.id, displayName: data.displayName, email: '', avatarHue: data.avatarHue }
}

function parseRole(value: unknown): Role {
  if (value === 'owner' || value === 'member') return value
  throw unexpected()
}

function parseMember(data: unknown): TripMember & { profile: Profile } {
  if (!isRecord(data) || !isString(data.tripId) || !isString(data.userId) || !isString(data.joinedAt)) {
    throw unexpected()
  }
  return {
    tripId: data.tripId,
    userId: data.userId,
    role: parseRole(data.role),
    joinedAt: data.joinedAt,
    profile: parseProfile(data.profile),
  }
}

const parseList = <T>(data: unknown, parseOne: (item: unknown) => T): T[] => {
  if (!Array.isArray(data)) throw unexpected()
  return data.map(parseOne)
}

async function readTrip(response: Response): Promise<Trip> {
  return parseTrip(await readJson(response))
}

const tripPath = (tripId: string): string => `/trips/${encodeURIComponent(tripId)}`
const codePath = (code: string): string => encodeURIComponent(code.trim())

/* Trips */

/** Every trip the signed-in member is on. */
export async function list(): Promise<Trip[]> {
  return parseList(await readJson(await request('GET', '/trips')), parseTrip)
}

export async function get(tripId: string): Promise<Trip> {
  return readTrip(await request('GET', tripPath(tripId)))
}

export async function create(input: NewTrip): Promise<Trip> {
  return readTrip(
    await request('POST', '/trips', {
      name: input.name,
      destination: input.destination,
      startDate: input.startDate,
      endDate: input.endDate,
    }),
  )
}

/** The fields the backend lets a patch change. Anything else on the object is left out. */
const PATCHABLE = [
  'name',
  'destination',
  'startDate',
  'endDate',
  'currency',
  'allowanceCents',
  'defaultEfficiency',
  'defaultPricePerLitreCents',
  'privateDebts',
  'budgetCapCents',
] as const

export async function update(tripId: string, patch: Partial<Trip>): Promise<Trip> {
  const body: Record<string, unknown> = {}
  for (const key of PATCHABLE) {
    if (patch[key] !== undefined) body[key] = patch[key]
  }
  return readTrip(await request('PATCH', tripPath(tripId), body))
}

/** Look up a trip by invite code without joining it, for the join preview. */
export async function previewByCode(
  code: string,
): Promise<{ trip: TripPreview; members: Profile[] }> {
  const data = await readJson(await request('GET', `/trips/preview/${codePath(code)}`))
  if (!isRecord(data)) throw unexpected()
  return {
    trip: parseTripPreview(data.trip),
    members: parseList(data.members, parseProfile),
  }
}

export async function joinByCode(code: string): Promise<Trip> {
  return readTrip(await request('POST', `/trips/join/${codePath(code)}`))
}

export async function regenerateCode(tripId: string): Promise<Trip> {
  return readTrip(await request('POST', `${tripPath(tripId)}/regenerate-code`))
}

/* Members */

export async function listMembers(tripId: string): Promise<(TripMember & { profile: Profile })[]> {
  return parseList(await readJson(await request('GET', `${tripPath(tripId)}/members`)), parseMember)
}

/** Removes someone, or leaves the trip when the id is the signed-in member's own. */
export async function removeMember(tripId: string, userId: string): Promise<void> {
  await request('DELETE', `${tripPath(tripId)}/members/${encodeURIComponent(userId)}`)
}

export async function updateRole(tripId: string, userId: string, role: Role): Promise<void> {
  await request('PATCH', `${tripPath(tripId)}/members/${encodeURIComponent(userId)}`, { role })
}
