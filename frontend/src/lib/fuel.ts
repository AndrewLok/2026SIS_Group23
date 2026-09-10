/*
 * Fuel cost maths. Pure, so the add-leg form and the leg list compute the same
 * four numbers from the same function rather than each doing their own version.
 */

import { splitEvenly } from '@/lib/money'
import type { FuelLeg } from '@/types'

export type FuelTotals = {
  litres: number
  costCents: number
  perRiderCents: number
  riderCount: number
}

export type FuelInput = {
  distanceKm: number
  efficiencyL100km: number
  pricePerLitreCents: number
  riderCount: number
}

/** litres = distance * efficiency / 100 */
export const litresFor = (distanceKm: number, efficiencyL100km: number): number =>
  (distanceKm * efficiencyL100km) / 100

/**
 * cost = litres * price per litre, rounded to whole cents once at the end.
 * Rounding here rather than per rider is what keeps the leg total honest.
 */
export const costCentsFor = (litres: number, pricePerLitreCents: number): number =>
  Math.round(litres * pricePerLitreCents)

/** All four figures the UI shows, from raw form values. */
export function computeFuel(input: FuelInput): FuelTotals {
  const litres = litresFor(input.distanceKm, input.efficiencyL100km)
  const costCents = costCentsFor(litres, input.pricePerLitreCents)
  const riderCount = Math.max(0, input.riderCount)
  const parts = splitEvenly(costCents, riderCount)
  return {
    litres,
    costCents,
    perRiderCents: parts[0] ?? 0,
    riderCount,
  }
}

/** The same figures for a stored leg. */
export const totalsForLeg = (leg: FuelLeg): FuelTotals =>
  computeFuel({
    distanceKm: leg.distanceKm,
    efficiencyL100km: leg.efficiencyL100km,
    pricePerLitreCents: leg.pricePerLitreCents,
    riderCount: leg.riderIds.length,
  })

/** Every leg's cost added together. */
export const totalFuelCents = (legs: FuelLeg[]): number =>
  legs.reduce((sum, leg) => sum + totalsForLeg(leg).costCents, 0)

/** What one member has been charged across every leg they rode on. */
export function fuelShareFor(legs: FuelLeg[], userId: string): number {
  return legs.reduce((sum, leg) => {
    if (!leg.riderIds.includes(userId)) return sum
    const riders = [...leg.riderIds].sort()
    const parts = splitEvenly(totalsForLeg(leg).costCents, riders.length)
    const index = riders.indexOf(userId)
    return sum + (parts[index] ?? 0)
  }, 0)
}
