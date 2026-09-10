/*
 * Pre-trip cost estimate. Pure, and deliberately transparent about what it used:
 * a low number must never be mistaken for a promise, so the UI shows the inputs
 * alongside the total.
 */

import { totalFuelCents } from '@/lib/fuel'
import type { Booking, FuelLeg } from '@/types'

export type EstimateInput = {
  bookings: Booking[]
  fuelLegs: FuelLeg[]
  /** Per-member manual allowance set in trip settings, in cents. */
  allowanceCents: number
  memberCount: number
}

export type Estimate = {
  bookingsCents: number
  fuelCents: number
  allowanceTotalCents: number
  totalCents: number
  perMemberCents: number
  /** What actually fed the number, for the "counted from" line under it. */
  inputs: {
    bookingsCounted: number
    bookingsWithoutCost: number
    fuelLegsCounted: number
    allowancePerMemberCents: number
  }
}

export function estimateTrip(input: EstimateInput): Estimate {
  const priced = input.bookings.filter((b) => b.costCents !== null)
  const bookingsCents = priced.reduce((sum, b) => sum + (b.costCents ?? 0), 0)
  const fuelCents = totalFuelCents(input.fuelLegs)
  const memberCount = Math.max(0, input.memberCount)
  const allowanceTotalCents = input.allowanceCents * memberCount
  const totalCents = bookingsCents + fuelCents + allowanceTotalCents

  return {
    bookingsCents,
    fuelCents,
    allowanceTotalCents,
    totalCents,
    perMemberCents: memberCount > 0 ? Math.round(totalCents / memberCount) : 0,
    inputs: {
      bookingsCounted: priced.length,
      bookingsWithoutCost: input.bookings.length - priced.length,
      fuelLegsCounted: input.fuelLegs.length,
      allowancePerMemberCents: input.allowanceCents,
    },
  }
}

/** Actual spend against the estimate, clamped so the bar never overruns its track. */
export function spendProgress(spentCents: number, estimateCents: number): number {
  if (estimateCents <= 0) return 0
  return Math.min(100, Math.round((spentCents / estimateCents) * 100))
}
