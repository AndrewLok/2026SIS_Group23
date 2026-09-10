import { inviteCode, latency, read, uid, write } from '@/services/mock/db'
import { ApiError, toProfile, toTrip, toTripMember } from '@/types'
import type { Profile, Role, Trip, TripMember } from '@/types'

export type NewTrip = {
  name: string
  destination: string
  startDate: string | null
  endDate: string | null
}

function requireSession(): string {
  const id = read().sessionUserId
  if (!id) throw new ApiError('forbidden', 'Sign in to do that.')
  return id
}

/** Every trip the signed-in member belongs to. */
export async function list(): Promise<Trip[]> {
  await latency()
  const userId = requireSession()
  const db = read()
  const tripIds = new Set(
    db.tripMembers.filter((m) => m.user_id === userId).map((m) => m.trip_id),
  )
  return db.trips.filter((t) => tripIds.has(t.id)).map(toTrip)
}

export async function get(tripId: string): Promise<Trip> {
  await latency()
  const row = read().trips.find((t) => t.id === tripId)
  if (!row) throw new ApiError('not_found', 'That trip does not exist.')
  return toTrip(row)
}

export async function create(input: NewTrip): Promise<Trip> {
  await latency()
  const userId = requireSession()
  if (!input.name.trim()) throw new ApiError('invalid', 'Give the trip a name.')
  const row = write((draft) => {
    const trip = {
      id: uid(),
      name: input.name.trim(),
      destination: input.destination.trim(),
      start_date: input.startDate,
      end_date: input.endDate,
      invite_code: inviteCode(),
      created_by: userId,
      currency: 'AUD',
      cover_hue: Math.floor(Math.random() * 360),
      allowance_cents: 25_000,
      default_efficiency: 8.0,
      default_price_per_litre_cents: 195,
      private_debts: true,
    }
    draft.trips.push(trip)
    draft.tripMembers.push({
      trip_id: trip.id,
      user_id: userId,
      role: 'owner' as Role,
      joined_at: new Date().toISOString(),
    })
    draft.channels.push({ id: uid(), trip_id: trip.id, name: 'general' })
    return trip
  })
  return toTrip(row)
}

export async function update(tripId: string, patch: Partial<Trip>): Promise<Trip> {
  await latency()
  const row = write((draft) => {
    const trip = draft.trips.find((t) => t.id === tripId)
    if (!trip) throw new ApiError('not_found', 'That trip does not exist.')
    if (patch.name !== undefined) trip.name = patch.name
    if (patch.destination !== undefined) trip.destination = patch.destination
    if (patch.startDate !== undefined) trip.start_date = patch.startDate
    if (patch.endDate !== undefined) trip.end_date = patch.endDate
    if (patch.allowanceCents !== undefined) trip.allowance_cents = patch.allowanceCents
    if (patch.privateDebts !== undefined) trip.private_debts = patch.privateDebts
    if (patch.defaultEfficiency !== undefined) trip.default_efficiency = patch.defaultEfficiency
    if (patch.defaultPricePerLitreCents !== undefined) {
      trip.default_price_per_litre_cents = patch.defaultPricePerLitreCents
    }
    return trip
  })
  return toTrip(row)
}

/** Look up a trip by invite code without joining it, for the join preview. */
export async function previewByCode(
  code: string,
): Promise<{ trip: Trip; members: Profile[] }> {
  await latency()
  const db = read()
  const row = db.trips.find((t) => t.invite_code === code.trim().toUpperCase())
  if (!row) throw new ApiError('not_found', 'That invite code does not match a trip.')
  const memberIds = db.tripMembers.filter((m) => m.trip_id === row.id).map((m) => m.user_id)
  const members = db.profiles.filter((p) => memberIds.includes(p.id)).map(toProfile)
  return { trip: toTrip(row), members }
}

export async function joinByCode(code: string): Promise<Trip> {
  await latency()
  const userId = requireSession()
  const row = write((draft) => {
    const trip = draft.trips.find((t) => t.invite_code === code.trim().toUpperCase())
    if (!trip) throw new ApiError('not_found', 'That invite code does not match a trip.')
    const already = draft.tripMembers.some(
      (m) => m.trip_id === trip.id && m.user_id === userId,
    )
    if (!already) {
      draft.tripMembers.push({
        trip_id: trip.id,
        user_id: userId,
        role: 'member' as Role,
        joined_at: new Date().toISOString(),
      })
    }
    return trip
  })
  return toTrip(row)
}

export async function regenerateCode(tripId: string): Promise<Trip> {
  await latency()
  const row = write((draft) => {
    const trip = draft.trips.find((t) => t.id === tripId)
    if (!trip) throw new ApiError('not_found', 'That trip does not exist.')
    trip.invite_code = inviteCode()
    return trip
  })
  return toTrip(row)
}

/* Members */

export async function listMembers(tripId: string): Promise<(TripMember & { profile: Profile })[]> {
  await latency()
  const db = read()
  return db.tripMembers
    .filter((m) => m.trip_id === tripId)
    .map((m) => {
      const profile = db.profiles.find((p) => p.id === m.user_id)
      if (!profile) throw new ApiError('not_found', 'A member profile is missing.')
      return { ...toTripMember(m), profile: toProfile(profile) }
    })
    .sort((a, b) => a.joinedAt.localeCompare(b.joinedAt))
}

export async function removeMember(tripId: string, userId: string): Promise<void> {
  await latency()
  write((draft) => {
    const index = draft.tripMembers.findIndex(
      (m) => m.trip_id === tripId && m.user_id === userId,
    )
    if (index === -1) throw new ApiError('not_found', 'That member is not on this trip.')
    const member = draft.tripMembers[index]
    if (member && member.role === 'owner') {
      const owners = draft.tripMembers.filter(
        (m) => m.trip_id === tripId && m.role === 'owner',
      )
      if (owners.length === 1) {
        throw new ApiError('forbidden', 'A trip needs an owner. Hand it over before you leave.')
      }
    }
    draft.tripMembers.splice(index, 1)
  })
}

export async function updateRole(tripId: string, userId: string, role: Role): Promise<void> {
  await latency()
  write((draft) => {
    const member = draft.tripMembers.find(
      (m) => m.trip_id === tripId && m.user_id === userId,
    )
    if (!member) throw new ApiError('not_found', 'That member is not on this trip.')
    member.role = role
  })
}
