import { describe, expect, it } from 'vitest'
import { legPatch, legPeople } from '@/lib/fuelEdit'
import { LEFT_THE_TRIP } from '@/lib/expenseEdit'
import type { FuelLeg } from '@/types'

const LEG: FuelLeg = {
  id: 'f-1',
  tripId: 't-1',
  label: 'Lorne to Apollo Bay',
  distanceKm: 46,
  efficiencyL100km: 8,
  pricePerLitreCents: 195,
  driverId: 'u-priya',
  riderIds: ['u-priya', 'u-jonas'],
  createdBy: 'u-priya',
  createdAt: '2030-06-15T00:00:00Z',
}

const FORM = { label: LEG.label, distanceKm: 46, efficiencyL100km: 8, pricePerLitreCents: 195, driverId: 'u-priya' }

describe('the patch for a fuel leg', () => {
  it('is empty when nothing changed, whatever order the riders come in', () => {
    expect(legPatch(LEG, FORM, ['u-jonas', 'u-priya'])).toEqual({})
  })

  it('is only the field that changed', () => {
    expect(legPatch(LEG, { ...FORM, label: 'Lorne to Anglesea' }, LEG.riderIds)).toEqual({ label: 'Lorne to Anglesea' })
    expect(legPatch(LEG, { ...FORM, distanceKm: 50.5 }, LEG.riderIds)).toEqual({ distanceKm: 50.5 })
    expect(legPatch(LEG, { ...FORM, efficiencyL100km: 9.2 }, LEG.riderIds)).toEqual({ efficiencyL100km: 9.2 })
    expect(legPatch(LEG, { ...FORM, pricePerLitreCents: 201 }, LEG.riderIds)).toEqual({ pricePerLitreCents: 201 })
    expect(legPatch(LEG, { ...FORM, driverId: 'u-jonas' }, LEG.riderIds)).toEqual({ driverId: 'u-jonas' })
  })

  it('ignores stray spaces around the label', () => {
    expect(legPatch(LEG, { ...FORM, label: ' Lorne to Apollo Bay ' }, LEG.riderIds)).toEqual({})
  })

  it('sends the riders in full only when the ticks changed', () => {
    expect(legPatch(LEG, FORM, ['u-priya', 'u-jonas', 'u-mia'])).toEqual({ riderIds: ['u-priya', 'u-jonas', 'u-mia'] })
    expect(legPatch(LEG, FORM, ['u-priya'])).toEqual({ riderIds: ['u-priya'] })
  })

  it('leaves out a rider who has left the trip only when it is asked to', () => {
    const withLeaver: FuelLeg = { ...LEG, riderIds: ['u-priya', 'u-gone'] }
    expect(legPatch(withLeaver, { ...FORM, distanceKm: 60 }, ['u-gone', 'u-priya'])).toEqual({ distanceKm: 60 })
    expect(legPatch(withLeaver, FORM, ['u-priya'])).toEqual({ riderIds: ['u-priya'] })
  })

  it('never sends who added it or the trip', () => {
    const patch = legPatch(LEG, { ...FORM, label: 'x', distanceKm: 1 }, ['u-priya'])
    for (const key of ['createdBy', 'createdAt', 'tripId', 'id']) expect(patch).not.toHaveProperty(key)
  })
})

describe('who the leg form shows', () => {
  const members = ['u-priya', 'u-jonas', 'u-mia'].map((id) => ({ id, displayName: id, email: '', avatarHue: 0 }))

  it('is the members when adding or when nobody has left', () => {
    expect(legPeople(undefined, members)).toEqual(members)
    expect(legPeople(LEG, members)).toEqual(members)
  })

  it('adds a driver or rider who has left, once, without a name', () => {
    const people = legPeople({ ...LEG, driverId: 'u-gone', riderIds: ['u-gone', 'u-jonas'] }, members)
    expect(people.map((p) => p.id)).toEqual(['u-priya', 'u-jonas', 'u-mia', 'u-gone'])
    expect(people[3]?.displayName).toBe(LEFT_THE_TRIP)
  })
})
