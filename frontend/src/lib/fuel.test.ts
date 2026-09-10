import { describe, expect, it } from 'vitest'
import { computeFuel, costCentsFor, litresFor, totalFuelCents, totalsForLeg } from '@/lib/fuel'
import { buildSeed } from '@/services/mock/seed'
import { agreeThreshold, hasReachedThreshold, tally } from '@/lib/voting'
import { estimateTrip, spendProgress } from '@/lib/estimate'
import { toBooking, toFuelLeg, toVote } from '@/types'

describe('fuel maths', () => {
  it('matches a hand calculation', () => {
    // 141 km at 9.4 L/100km = 13.254 L; at 198 c/L = 2624.292 c, rounded to 2624.
    expect(litresFor(141, 9.4)).toBeCloseTo(13.254, 6)
    expect(costCentsFor(13.254, 198)).toBe(2624)
  })

  it('splits a leg across its riders without losing a cent', () => {
    const totals = computeFuel({
      distanceKm: 190,
      efficiencyL100km: 9.4,
      pricePerLitreCents: 205,
      riderCount: 3,
    })
    expect(totals.litres).toBeCloseTo(17.86, 6)
    expect(totals.costCents).toBe(3661)
    // 3661 / 3 = 1220 remainder 1, so the first rider carries the extra cent.
    expect(totals.perRiderCents).toBe(1221)
  })

  it('handles a leg with no riders rather than dividing by zero', () => {
    const totals = computeFuel({
      distanceKm: 100,
      efficiencyL100km: 8,
      pricePerLitreCents: 200,
      riderCount: 0,
    })
    expect(totals.perRiderCents).toBe(0)
    expect(Number.isFinite(totals.costCents)).toBe(true)
  })

  it('totals every seeded leg', () => {
    const legs = buildSeed().fuelLegs.map(toFuelLeg)
    const summed = legs.reduce((sum, leg) => sum + totalsForLeg(leg).costCents, 0)
    expect(totalFuelCents(legs)).toBe(summed)
  })

  it('agrees with the expense each seeded leg wrote through to', () => {
    // Without this the fuel screen and the expense log can quietly disagree,
    // which is exactly the bug the first version of this seed shipped with.
    const seed = buildSeed()
    const legs = seed.fuelLegs.map(toFuelLeg)
    for (const leg of legs) {
      const expense = seed.expenses.find(
        (e) => e.source === 'fuel' && e.source_id === leg.id,
      )
      expect(expense, `no expense written through for ${leg.id}`).toBeDefined()
      expect(expense?.amount_cents).toBe(totalsForLeg(leg).costCents)
      expect(expense?.paid_by).toBe(leg.driverId)
    }
  })
})

describe('voting threshold', () => {
  it('needs more than half the members', () => {
    expect(agreeThreshold(4)).toBe(3)
    expect(agreeThreshold(5)).toBe(3)
    expect(agreeThreshold(6)).toBe(4)
    expect(agreeThreshold(8)).toBe(5)
  })

  it('promotes only at or above the line', () => {
    expect(hasReachedThreshold(2, 5)).toBe(false)
    expect(hasReachedThreshold(3, 5)).toBe(true)
    expect(hasReachedThreshold(0, 0)).toBe(false)
  })

  it('tallies a seeded idea correctly', () => {
    const votes = buildSeed().votes.map(toVote)
    const result = tally(votes, 'idea-otway', 'usr-jonas')
    expect(result.agree).toBe(4)
    expect(result.disagree).toBe(1)
    expect(result.own).toBe(-1)
  })

  it('reports no own vote for a member who has not voted', () => {
    const votes = buildSeed().votes.map(toVote)
    expect(tally(votes, 'idea-surf', 'usr-lachlan').own).toBeNull()
  })
})

describe('trip estimate', () => {
  const seed = buildSeed()

  it('adds bookings, fuel and the per-member allowance', () => {
    const bookings = seed.bookings.map(toBooking)
    const fuelLegs = seed.fuelLegs.map(toFuelLeg)
    const estimate = estimateTrip({
      bookings,
      fuelLegs,
      allowanceCents: 25_000,
      memberCount: 5,
    })
    const expectedBookings = bookings.reduce((s, b) => s + (b.costCents ?? 0), 0)
    expect(estimate.bookingsCents).toBe(expectedBookings)
    expect(estimate.fuelCents).toBe(totalFuelCents(fuelLegs))
    expect(estimate.allowanceTotalCents).toBe(125_000)
    expect(estimate.totalCents).toBe(
      estimate.bookingsCents + estimate.fuelCents + estimate.allowanceTotalCents,
    )
    expect(estimate.inputs.bookingsCounted).toBe(4)
  })

  it('does not divide by zero with no members', () => {
    const estimate = estimateTrip({
      bookings: [],
      fuelLegs: [],
      allowanceCents: 25_000,
      memberCount: 0,
    })
    expect(estimate.perMemberCents).toBe(0)
  })

  it('clamps spend progress to the track', () => {
    expect(spendProgress(0, 1000)).toBe(0)
    expect(spendProgress(500, 1000)).toBe(50)
    expect(spendProgress(5000, 1000)).toBe(100)
    expect(spendProgress(500, 0)).toBe(0)
  })
})
