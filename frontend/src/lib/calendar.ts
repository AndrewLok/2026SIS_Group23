/*
 * Calendar items are derived, never stored.
 *
 * One selector maps agreed ideas and bookings into a single shape sorted by
 * start time, so the agenda view, the month view and the overview's next-up
 * reading all read the same list and cannot disagree with each other.
 */

import type { Booking, Idea } from '@/types'

export type CalendarSource = 'idea' | 'flight' | 'stay' | 'car' | 'other'

export type CalendarItem = {
  /** Unique within the merged list. */
  id: string
  source: CalendarSource
  title: string
  startsAt: string
  endsAt: string | null
  allDay: boolean
  /** The idea or booking this came from, for the link back. */
  refId: string
  /** Set on a personal booking, so it can be shown as one member's. */
  belongsTo: string | null
  detail: string
}

export function toCalendarItems(ideas: Idea[], bookings: Booking[]): CalendarItem[] {
  const fromIdeas: CalendarItem[] = ideas
    .filter((idea) => idea.status === 'agreed' && idea.proposedStart !== null)
    .map((idea) => ({
      id: `idea:${idea.id}`,
      source: 'idea' as const,
      title: idea.title,
      startsAt: idea.proposedStart as string,
      endsAt: idea.proposedEnd,
      allDay: idea.allDay,
      refId: idea.id,
      belongsTo: null,
      detail: idea.description,
    }))

  const fromBookings: CalendarItem[] = bookings
    .filter((booking) => booking.startsAt !== null)
    .map((booking) => ({
      id: `booking:${booking.id}`,
      source: booking.type,
      title: booking.title,
      startsAt: booking.startsAt as string,
      endsAt: booking.endsAt,
      allDay: false,
      refId: booking.id,
      belongsTo: booking.belongsTo,
      detail: [booking.provider, booking.reference].filter(Boolean).join(' · '),
    }))

  return [...fromIdeas, ...fromBookings].sort((a, b) => a.startsAt.localeCompare(b.startsAt))
}

/** The next thing happening from now, which is half of what the overview answers. */
export function nextUp(items: CalendarItem[], from: Date = new Date()): CalendarItem | null {
  const cutoff = from.toISOString()
  return items.find((item) => (item.endsAt ?? item.startsAt) >= cutoff) ?? null
}

export const sourceLabel: Record<CalendarSource, string> = {
  idea: 'Agreed',
  flight: 'Flight',
  stay: 'Stay',
  car: 'Car',
  other: 'Booking',
}

/*
 * Source markers stay inside the panel's own tonal range rather than reaching
 * for a category palette. Radium marks what the group agreed to, because that
 * is a live reading; everything else is a booking someone already made, and
 * those separate by tone. Amber is not used here: it means a figure wanting
 * attention, and a hotel check-in is not that.
 */
export const sourceColor: Record<CalendarSource, string> = {
  idea: 'var(--radium)',
  flight: 'var(--luminous)',
  stay: 'var(--placard)',
  car: 'var(--bezel-edge)',
  other: 'var(--bezel-edge)',
}
