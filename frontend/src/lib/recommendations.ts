/*
 * Booking recommendations: what the app suggests booking, and what each would do to the trip's money.
 * They are fixed examples, the same on every trip. The providers and prices are made up and nothing
 * is looked up; adding one makes an ordinary booking that can be edited or deleted.
 */

import { addDays, format, parseISO } from 'date-fns'
import { GROUP, type BookingForm } from '@/lib/bookingEdit'
import type { BookingType } from '@/types'

export type Recommendation = {
  id: string
  type: BookingType
  title: string
  provider: string
  origin: string
  destination: string
  /** What it would cost the group in total. */
  costCents: number
  blurb: string
  /** Days after the trip's first day, and the time of day, it starts and ends. */
  startsDay: number
  startsTime: string
  endsDay: number
  endsTime: string
}

export const RECOMMENDATIONS: Recommendation[] = [
  {
    id: 'stay-seaview-cottage',
    type: 'stay',
    title: 'Seaview Cottage, 3 nights',
    provider: 'Coastal Escapes',
    origin: '',
    destination: 'Apollo Bay VIC',
    costCents: 126_000,
    blurb: 'Four bedrooms a short walk from the beach, sleeps the whole group.',
    startsDay: 1,
    startsTime: '15:00',
    endsDay: 4,
    endsTime: '10:00',
  },
  {
    id: 'car-compact-suv',
    type: 'car',
    title: 'Compact SUV hire, 4 days',
    provider: 'Open Road Rentals',
    origin: 'Melbourne Airport',
    destination: 'Melbourne Airport',
    costCents: 35_200,
    blurb: 'Pick up at the airport and drop back there. Fuel is on you, and on the fuel screen.',
    startsDay: 0,
    startsTime: '09:00',
    endsDay: 4,
    endsTime: '17:00',
  },
]

/** The booking form for a recommendation. Times are filled in from the trip's first day, if it has one. */
export function prefillFor(rec: Recommendation, tripStartDay: string | null): BookingForm {
  const at = (day: number, time: string): string =>
    tripStartDay ? `${format(addDays(parseISO(tripStartDay), day), 'yyyy-MM-dd')}T${time}` : ''
  return {
    type: rec.type,
    title: rec.title,
    provider: rec.provider,
    reference: '',
    startsAt: at(rec.startsDay, rec.startsTime),
    endsAt: at(rec.endsDay, rec.endsTime),
    origin: rec.origin,
    destination: rec.destination,
    notes: '',
    belongsTo: GROUP,
  }
}
