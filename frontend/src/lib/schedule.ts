/*
 * The calendar grid: where each block sits when times overlap, where the gaps
 * are, and what goes on it. Pure, so the free-time figure can be checked by hand.
 */

import { addDays, eachDayOfInterval, parseISO, startOfDay } from 'date-fns'
import { sourceColor, sourceLabel, toCalendarItems } from '@/lib/calendar'
import { tally } from '@/lib/voting'
import type { Booking, Idea, Profile, Trip, Vote } from '@/types'

/** Anything without an end is drawn as an hour long. */
export const DEFAULT_MINUTES = 60

/** The part of the day free time is counted over. Nobody wants a 3am activity. */
export const WAKING_START_HOUR = 8
export const WAKING_END_HOUR = 22

const MINUTE = 60 * 1000

export type Span = { start: number; end: number }

export type Placed<T> = Span & {
  item: T
  /** Which side-by-side lane the block takes, from zero. */
  column: number
  /** How many lanes its cluster of overlapping blocks needs. */
  columns: number
}

/** End time in ms, falling back to an hour after the start. */
export function endOf(startIso: string, endIso: string | null): number {
  const start = Date.parse(startIso)
  const end = endIso ? Date.parse(endIso) : NaN
  return Number.isFinite(end) && end > start ? end : start + DEFAULT_MINUTES * MINUTE
}

/**
 * Lay blocks out side by side the way a calendar app does: blocks that overlap
 * share the width of their cluster, each in the lowest lane free at its start.
 */
export function layoutDay<T>(blocks: (Span & { item: T })[]): Placed<T>[] {
  const sorted = [...blocks].sort((a, b) => a.start - b.start || b.end - a.end)
  const out: Placed<T>[] = []
  let cluster: Placed<T>[] = []
  let clusterEnd = -Infinity

  const flush = () => {
    const columns = Math.max(...cluster.map((c) => c.column)) + 1
    for (const c of cluster) out.push({ ...c, columns })
    cluster = []
    clusterEnd = -Infinity
  }

  for (const block of sorted) {
    if (cluster.length > 0 && block.start >= clusterEnd) flush()
    const taken = new Set(cluster.filter((c) => c.end > block.start).map((c) => c.column))
    let column = 0
    while (taken.has(column)) column++
    cluster.push({ ...block, column, columns: 1 })
    clusterEnd = Math.max(clusterEnd, block.end)
  }
  if (cluster.length > 0) flush()
  return out
}

/** The gaps inside a window that no span covers. */
export function freeGaps(spans: Span[], window: Span): Span[] {
  const clipped = spans
    .map((s) => ({ start: Math.max(s.start, window.start), end: Math.min(s.end, window.end) }))
    .filter((s) => s.end > s.start)
    .sort((a, b) => a.start - b.start)

  const gaps: Span[] = []
  let cursor = window.start
  for (const s of clipped) {
    if (s.start > cursor) gaps.push({ start: cursor, end: s.start })
    cursor = Math.max(cursor, s.end)
  }
  if (cursor < window.end) gaps.push({ start: cursor, end: window.end })
  return gaps
}

export const minutesIn = (span: Span): number => Math.round((span.end - span.start) / MINUTE)

/** "2h 30m", "3h", "45m". */
export function formatMinutes(total: number): string {
  const hours = Math.floor(total / 60)
  const minutes = total % 60
  if (hours === 0) return `${minutes}m`
  return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`
}

/** Do two spans share any time at all? Touching ends do not count. */
export const overlaps = (a: Span, b: Span): boolean => a.start < b.end && b.start < a.end

/* What goes on the grid, built from the trip's activities, votes and bookings. */

export type ActivityMode = 'plan' | 'vote'
/** What the add-activity form starts with; times are datetime-local strings. */
export type ActivityPreset = { mode: ActivityMode; start: string; end: string }
export const blankPreset: ActivityPreset = { mode: 'plan', start: '', end: '' }

export type ScheduleEntry = {
  id: string
  title: string
  startsAt: string
  endsAt: string | null
  allDay: boolean
  /** plan: going ahead. proposal: still up for a vote. booking: already booked. */
  kind: 'plan' | 'proposal' | 'booking'
  /** The activity or booking it came from. */
  refId: string
  color: string
  label: string
  detail: string
  people: Profile[]
}

export function scheduleEntries(
  ideas: Idea[],
  votes: Vote[],
  bookings: Booking[],
  profiles: Map<string, Profile>,
): ScheduleEntry[] {
  const byId = new Map(ideas.map((i) => [i.id, i]))
  const peopleFor = (ids: string[]) =>
    ids.map((id) => profiles.get(id)).filter((p): p is Profile => p !== undefined)

  return [
    ...toCalendarItems(ideas, bookings).map((item) => ({
      id: item.id,
      title: item.title,
      startsAt: item.startsAt,
      endsAt: item.endsAt,
      allDay: item.allDay,
      kind: item.source === 'idea' ? ('plan' as const) : ('booking' as const),
      refId: item.refId,
      color: sourceColor[item.source],
      label: sourceLabel[item.source],
      detail: item.detail,
      people:
        item.source === 'idea'
          ? peopleFor(byId.get(item.refId)?.attendeeIds ?? [])
          : peopleFor(item.belongsTo ? [item.belongsTo] : []),
    })),
    ...ideas
      .filter((i) => i.status === 'voting' && i.proposedStart !== null)
      .map((i) => ({
        id: `vote:${i.id}`,
        title: i.title,
        startsAt: i.proposedStart as string,
        endsAt: i.proposedEnd,
        allDay: i.allDay,
        kind: 'proposal' as const,
        refId: i.id,
        color: 'var(--radium)',
        label: 'Up for a vote',
        detail: i.description,
        people: peopleFor(tally(votes, i.id, null).agreeIds),
      })),
  ]
}

/** The trip's days, or failing that the days things are happening on, or the coming week. */
export function scheduleDays(trip: Trip | undefined, entries: ScheduleEntry[]): Date[] {
  let start = trip?.startDate ? parseISO(trip.startDate) : null
  let end = trip?.endDate ? parseISO(trip.endDate) : null
  if (!start || !end) {
    const times = entries.map((e) => Date.parse(e.startsAt)).filter(Number.isFinite)
    start = times.length > 0 ? new Date(Math.min(...times)) : new Date()
    end = times.length > 0 ? new Date(Math.max(...times)) : addDays(start, 6)
  }
  if (end < start) end = start
  // A month is plenty of columns to scroll through.
  if (end.getTime() - start.getTime() > 31 * 24 * 60 * 60 * 1000) end = addDays(start, 30)
  return eachDayOfInterval({ start: startOfDay(start), end: startOfDay(end) })
}
