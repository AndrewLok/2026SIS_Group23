import { describe, expect, it } from 'vitest'
import { bookingFormOf, bookingPatch } from '@/lib/bookingEdit'
import type { Booking } from '@/types'

const BOOKING: Booking = {
  id: 'b-1',
  tripId: 't-1',
  type: 'flight',
  title: 'JQ 610 BNE to MEL',
  provider: 'Jetstar',
  reference: 'K4RT2W',
  startsAt: '2030-06-15T02:30:00.000Z',
  endsAt: null,
  origin: 'BNE',
  destination: 'MEL',
  costCents: 21500,
  belongsTo: 'u-jonas',
  notes: 'window',
  createdBy: 'u-jonas',
}

describe('the form for a booking', () => {
  it('reads every field, with "the whole group" for a booking nobody owns and empty for no time', () => {
    const form = bookingFormOf({ ...BOOKING, belongsTo: null })
    expect(form.belongsTo).toBe('group')
    expect(form.endsAt).toBe('')
    expect(form.startsAt).toMatch(/^2030-06-1\dT\d\d:\d\d$/)
    expect(form).toMatchObject({ type: 'flight', title: BOOKING.title, origin: 'BNE', notes: 'window' })
  })

  it('sends nothing when nothing changed', () => {
    expect(bookingPatch(BOOKING, bookingFormOf(BOOKING), BOOKING.costCents)).toEqual({})
  })
})

describe('the patch for a booking', () => {
  const same = () => bookingFormOf(BOOKING)

  it('is only the field that changed', () => {
    expect(bookingPatch(BOOKING, { ...same(), title: 'JQ 612' }, 21500)).toEqual({ title: 'JQ 612' })
    expect(bookingPatch(BOOKING, { ...same(), type: 'other' }, 21500)).toEqual({ type: 'other' })
    expect(bookingPatch(BOOKING, { ...same(), notes: '' }, 21500)).toEqual({ notes: '' })
  })

  it('turns a new time into the stored instant, and a cleared time into null', () => {
    const moved = bookingPatch(BOOKING, { ...same(), endsAt: '2030-06-15T18:00' }, 21500)
    expect(moved).toEqual({ endsAt: new Date('2030-06-15T18:00').toISOString() })
    expect(bookingPatch(BOOKING, { ...same(), startsAt: '' }, 21500)).toEqual({ startsAt: null })
  })

  it('moves a booking to the whole group with null, and to a person with their id', () => {
    expect(bookingPatch(BOOKING, { ...same(), belongsTo: 'group' }, 21500)).toEqual({ belongsTo: null })
    const group = { ...BOOKING, belongsTo: null }
    expect(bookingPatch(group, { ...bookingFormOf(group), belongsTo: 'u-mia' }, 21500)).toEqual({ belongsTo: 'u-mia' })
  })

  it('changes the cost, clears it with null, and tells nothing from a cost of zero', () => {
    expect(bookingPatch(BOOKING, same(), 30000)).toEqual({ costCents: 30000 })
    expect(bookingPatch(BOOKING, same(), null)).toEqual({ costCents: null })
    expect(bookingPatch(BOOKING, same(), 0)).toEqual({ costCents: 0 })
    const free = { ...BOOKING, costCents: null }
    expect(bookingPatch(free, bookingFormOf(free), null)).toEqual({})
    expect(bookingPatch(free, bookingFormOf(free), 0)).toEqual({ costCents: 0 })
  })

  it('never sends who added it, the trip, or the id', () => {
    const patch = bookingPatch(BOOKING, { ...same(), title: 'x', type: 'car', notes: 'y' }, 1)
    for (const key of ['createdBy', 'tripId', 'id']) expect(patch).not.toHaveProperty(key)
  })
})
