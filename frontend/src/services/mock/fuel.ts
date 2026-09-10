/*
 * Fuel legs, and the expense each one writes through to.
 *
 * A leg is the only thing in the app that splits across a subset of the group,
 * so it carries its own rider list and its expense is marked source: 'fuel'.
 * The expenses screen treats that expense as read only and links back here.
 */

import { latency, read, uid, write } from '@/services/mock/db'
import { computeFuel } from '@/lib/fuel'
import { ApiError, toFuelLeg } from '@/types'
import type { FuelLeg } from '@/types'

export type NewFuelLeg = {
  tripId: string
  label: string
  distanceKm: number
  efficiencyL100km: number
  pricePerLitreCents: number
  driverId: string
  riderIds: string[]
}

const describe = (label: string): string => `Fuel: ${label}`

export async function list(tripId: string): Promise<FuelLeg[]> {
  await latency()
  return read()
    .fuelLegs.filter((l) => l.trip_id === tripId)
    .map(toFuelLeg)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

export async function create(input: NewFuelLeg): Promise<FuelLeg> {
  await latency()
  if (!input.label.trim()) throw new ApiError('invalid', 'Name the leg, like "Lorne to Apollo Bay".')
  if (input.distanceKm <= 0) throw new ApiError('invalid', 'Enter a distance above zero.')
  if (input.riderIds.length === 0) {
    throw new ApiError('invalid', 'Pick at least one person to chip in.')
  }

  const row = write((draft) => {
    const now = new Date().toISOString()
    const leg = {
      id: uid(),
      trip_id: input.tripId,
      label: input.label.trim(),
      distance_km: input.distanceKm,
      efficiency_l_100km: input.efficiencyL100km,
      price_per_litre_cents: input.pricePerLitreCents,
      driver_id: input.driverId,
      rider_ids: [...input.riderIds],
      created_at: now,
    }
    draft.fuelLegs.push(leg)

    const totals = computeFuel({
      distanceKm: leg.distance_km,
      efficiencyL100km: leg.efficiency_l_100km,
      pricePerLitreCents: leg.price_per_litre_cents,
      riderCount: leg.rider_ids.length,
    })

    draft.expenses.push({
      id: uid(),
      trip_id: leg.trip_id,
      description: describe(leg.label),
      amount_cents: totals.costCents,
      paid_by: leg.driver_id,
      spent_at: now,
      category: 'transport',
      source: 'fuel',
      source_id: leg.id,
    })

    // Remember the defaults so the next leg's form is not empty.
    const trip = draft.trips.find((t) => t.id === leg.trip_id)
    if (trip) {
      trip.default_efficiency = leg.efficiency_l_100km
      trip.default_price_per_litre_cents = leg.price_per_litre_cents
    }

    return leg
  })

  return toFuelLeg(row)
}

export async function update(legId: string, patch: Partial<FuelLeg>): Promise<FuelLeg> {
  await latency()
  const row = write((draft) => {
    const leg = draft.fuelLegs.find((l) => l.id === legId)
    if (!leg) throw new ApiError('not_found', 'That leg has been deleted.')
    if (patch.label !== undefined) leg.label = patch.label
    if (patch.distanceKm !== undefined) leg.distance_km = patch.distanceKm
    if (patch.efficiencyL100km !== undefined) leg.efficiency_l_100km = patch.efficiencyL100km
    if (patch.pricePerLitreCents !== undefined) {
      leg.price_per_litre_cents = patch.pricePerLitreCents
    }
    if (patch.driverId !== undefined) leg.driver_id = patch.driverId
    if (patch.riderIds !== undefined) leg.rider_ids = [...patch.riderIds]

    // Keep the written-through expense in step with the leg.
    const expense = draft.expenses.find((e) => e.source === 'fuel' && e.source_id === leg.id)
    if (expense) {
      const totals = computeFuel({
        distanceKm: leg.distance_km,
        efficiencyL100km: leg.efficiency_l_100km,
        pricePerLitreCents: leg.price_per_litre_cents,
        riderCount: leg.rider_ids.length,
      })
      expense.description = describe(leg.label)
      expense.amount_cents = totals.costCents
      expense.paid_by = leg.driver_id
    }

    return leg
  })
  return toFuelLeg(row)
}

export async function remove(legId: string): Promise<void> {
  await latency()
  write((draft) => {
    draft.fuelLegs = draft.fuelLegs.filter((l) => l.id !== legId)
    draft.expenses = draft.expenses.filter(
      (e) => !(e.source === 'fuel' && e.source_id === legId),
    )
  })
}
