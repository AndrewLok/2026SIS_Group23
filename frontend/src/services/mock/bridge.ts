/*
 * TEMPORARY BRIDGE, for as long as part of the app is real and part is still mock.
 *
 * The mock services (expenses, fuel, bookings) find "who is signed in" and
 * "who is on this trip" in the local store, and they key everything by trip id. While sign-in,
 * trips and members come from the backend, each real response is mirrored in here so those mock
 * screens keep working on real trips, with real people, without knowing the difference.
 *
 * It only ever copies what the backend said, and the backend stays the source of truth: every
 * fresh response overwrites the mirror. Delete this file, and its callers in services/http, once
 * the last mock service has a backend.
 */

import { write } from '@/services/mock/db'
import type { Profile, Role, Trip, TripMember } from '@/types'

/** The signed-in account, or null to sign out. */
export function adoptSession(profile: Profile | null): void {
  write((draft) => {
    if (!profile) {
      draft.sessionUserId = null
      return
    }
    const row = {
      id: profile.id,
      display_name: profile.displayName,
      email: profile.email,
      avatar_hue: profile.avatarHue,
    }
    const index = draft.profiles.findIndex((p) => p.id === profile.id)
    if (index === -1) draft.profiles.push(row)
    else draft.profiles[index] = row
    draft.sessionUserId = profile.id
  })
}

/** Trips as the backend sent them. */
export function adoptTrips(trips: Trip[]): void {
  write((draft) => {
    for (const trip of trips) {
      const row = {
        id: trip.id,
        name: trip.name,
        destination: trip.destination,
        start_date: trip.startDate,
        end_date: trip.endDate,
        invite_code: trip.inviteCode,
        created_by: trip.createdBy,
        currency: trip.currency,
        cover_hue: trip.coverHue,
        allowance_cents: trip.allowanceCents,
        default_efficiency: trip.defaultEfficiency,
        default_price_per_litre_cents: trip.defaultPricePerLitreCents,
        private_debts: trip.privateDebts,
      }
      const index = draft.trips.findIndex((t) => t.id === trip.id)
      if (index === -1) draft.trips.push(row)
      else draft.trips[index] = row
    }
  })
}

type MemberWithProfile = TripMember & { profile: Profile }

/**
 * The full member list of one trip, replacing whatever was mirrored before, so someone who left
 * stops counting towards splits and vote thresholds.
 */
export function adoptMembers(tripId: string, members: MemberWithProfile[]): void {
  write((draft) => {
    draft.tripMembers = draft.tripMembers.filter((m) => m.trip_id !== tripId)
    for (const member of members) {
      draft.tripMembers.push({
        trip_id: member.tripId,
        user_id: member.userId,
        role: member.role as Role,
        joined_at: member.joinedAt,
      })

      // The backend does not send other members' emails. Keep the one we already have, which is
      // the signed-in person's own (it came with their session).
      const existing = draft.profiles.find((p) => p.id === member.profile.id)
      const row = {
        id: member.profile.id,
        display_name: member.profile.displayName,
        email: member.profile.email || existing?.email || '',
        avatar_hue: member.profile.avatarHue,
      }
      if (existing) Object.assign(existing, row)
      else draft.profiles.push(row)
    }
  })
}
