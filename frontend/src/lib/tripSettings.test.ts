import { afterEach, describe, expect, it, vi } from 'vitest'
import { detailsPatch, isEmptyPatch, sharedPatch } from '@/lib/tripSettings'
import { dayToIso, isoToDay } from '@/lib/dates'
import type { Trip } from '@/types'

afterEach(() => {
  vi.unstubAllEnvs()
})

const TRIP: Trip = {
  id: 't-1',
  name: 'Great Ocean Road',
  destination: 'Victoria',
  startDate: dayToIso('2026-11-08'),
  endDate: dayToIso('2026-11-15'),
  inviteCode: 'K7M2QX',
  createdBy: 'u-priya',
  currency: 'AUD',
  coverHue: 120,
  allowanceCents: 25_000,
  defaultEfficiency: 8,
  defaultPricePerLitreCents: 195,
  privateDebts: true,
  budgetCapCents: null,
}

const SAME = {
  name: 'Great Ocean Road',
  destination: 'Victoria',
  startDate: '2026-11-08',
  endDate: '2026-11-15',
  budgetCapCents: null,
}

describe('the owner’s details', () => {
  it('send nothing when nothing changed', () => {
    expect(detailsPatch(TRIP, SAME)).toEqual({})
    expect(isEmptyPatch(detailsPatch(TRIP, SAME))).toBe(true)
  })

  it('send only the field that changed', () => {
    expect(detailsPatch(TRIP, { ...SAME, name: 'Road trip' })).toEqual({ name: 'Road trip' })
    expect(detailsPatch(TRIP, { ...SAME, destination: 'Tasmania' })).toEqual({ destination: 'Tasmania' })
    expect(detailsPatch(TRIP, { ...SAME, budgetCapCents: 300_000 })).toEqual({ budgetCapCents: 300_000 })
  })

  it('ignore stray spaces around a name or place', () => {
    expect(detailsPatch(TRIP, { ...SAME, name: '  Great Ocean Road ', destination: ' Victoria  ' })).toEqual({})
    expect(detailsPatch(TRIP, { ...SAME, name: '  Road trip ' })).toEqual({ name: 'Road trip' })
  })

  it('turn a changed day into the instant the app stores, whatever the zone', () => {
    for (const zone of ['UTC', 'Pacific/Auckland', 'America/Los_Angeles', 'Pacific/Honolulu']) {
      vi.stubEnv('TZ', zone)
      // Dates are stored as noon on the picker's own clock, so the trip is made in each zone.
      const trip = { ...TRIP, startDate: dayToIso('2026-11-08'), endDate: dayToIso('2026-11-15') }
      expect(detailsPatch(trip, SAME)).toEqual({})
      expect(detailsPatch(trip, { ...SAME, startDate: '2026-11-09' })).toEqual({
        startDate: dayToIso('2026-11-09'),
      })
    }
  })

  it('does not call a trip changed just because someone in another zone set its dates', () => {
    // Set by someone at noon in Sydney, opened and saved untouched by someone in Honolulu: the form
    // shows Honolulu's day for that instant, and an untouched form is an empty patch.
    vi.stubEnv('TZ', 'Australia/Sydney')
    const setInSydney = { ...TRIP, startDate: dayToIso('2026-11-08'), endDate: dayToIso('2026-11-15') }
    vi.stubEnv('TZ', 'Pacific/Honolulu')
    const shownInHonolulu = {
      ...SAME,
      startDate: isoToDay(setInSydney.startDate as string),
      endDate: isoToDay(setInSydney.endDate as string),
    }
    expect(detailsPatch(setInSydney, shownInHonolulu)).toEqual({})
  })

  it('clear a date with null, and a cap with null, which is not the same as leaving them alone', () => {
    expect(detailsPatch(TRIP, { ...SAME, startDate: '' })).toEqual({ startDate: null })
    expect(detailsPatch(TRIP, { ...SAME, endDate: '' })).toEqual({ endDate: null })
    const capped = { ...TRIP, budgetCapCents: 100_000 }
    expect(detailsPatch(capped, { ...SAME, budgetCapCents: null })).toEqual({ budgetCapCents: null })
  })

  it('set a date on a trip that had none', () => {
    const undated = { ...TRIP, startDate: null, endDate: null }
    expect(detailsPatch(undated, { ...SAME, startDate: '', endDate: '' })).toEqual({})
    expect(detailsPatch(undated, { ...SAME, startDate: '2026-12-01', endDate: '' })).toEqual({
      startDate: dayToIso('2026-12-01'),
    })
  })

  it('allow a cap of nothing', () => {
    expect(detailsPatch(TRIP, { ...SAME, budgetCapCents: 0 })).toEqual({ budgetCapCents: 0 })
  })
})

describe('what every member may change', () => {
  const SHARED = { allowanceCents: 25_000, defaultEfficiency: 8, defaultPricePerLitreCents: 195 }

  it('sends nothing when nothing changed', () => {
    expect(sharedPatch(TRIP, SHARED)).toEqual({})
  })

  it('sends only what changed, and never an owner-only field', () => {
    const patch = sharedPatch(TRIP, { allowanceCents: 30_000, defaultEfficiency: 7.5, defaultPricePerLitreCents: 195 })
    expect(patch).toEqual({ allowanceCents: 30_000, defaultEfficiency: 7.5 })
    for (const owner of ['name', 'destination', 'startDate', 'endDate', 'currency', 'budgetCapCents']) {
      expect(patch).not.toHaveProperty(owner)
    }
  })

  it('allows an allowance of nothing', () => {
    expect(sharedPatch(TRIP, { ...SHARED, allowanceCents: 0 })).toEqual({ allowanceCents: 0 })
  })
})
