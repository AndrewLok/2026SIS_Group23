/*
 * Editing a fuel leg: what to send, and who the form shows. Only what changed is sent. The riders go
 * only if the ticks changed, so a leg that still has someone on it who has since left the trip keeps
 * them, as the server's rules for leavers intend.
 */

import { LEFT_THE_TRIP } from '@/lib/expenseEdit'
import type { FuelLeg, Profile } from '@/types'

export type LegEditForm = {
  label: string
  distanceKm: number
  efficiencyL100km: number
  pricePerLitreCents: number
  driverId: string
}

const sameIds = (a: string[], b: string[]): boolean => {
  const left = new Set(a)
  const right = new Set(b)
  return left.size === right.size && [...left].every((id) => right.has(id))
}

/** The members, plus a driver or rider of this leg who has left the trip. Nobody else who left is offered. */
export function legPeople(leg: FuelLeg | undefined, members: Profile[]): Profile[] {
  if (!leg) return members
  const onTrip = new Set(members.map((m) => m.id))
  const leavers = [...new Set([leg.driverId, ...leg.riderIds])]
    .filter((id) => !onTrip.has(id))
    .map((id) => ({ id, displayName: LEFT_THE_TRIP, email: '', avatarHue: 0 }))
  return [...members, ...leavers]
}

export function legPatch(leg: FuelLeg, form: LegEditForm, riderIds: string[]): Partial<FuelLeg> {
  const patch: Partial<FuelLeg> = {}
  if (form.label.trim() !== leg.label) patch.label = form.label.trim()
  if (form.distanceKm !== leg.distanceKm) patch.distanceKm = form.distanceKm
  if (form.efficiencyL100km !== leg.efficiencyL100km) patch.efficiencyL100km = form.efficiencyL100km
  if (form.pricePerLitreCents !== leg.pricePerLitreCents) patch.pricePerLitreCents = form.pricePerLitreCents
  if (form.driverId !== leg.driverId) patch.driverId = form.driverId
  if (!sameIds(riderIds, leg.riderIds)) patch.riderIds = riderIds
  return patch
}
