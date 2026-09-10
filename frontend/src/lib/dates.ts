/*
 * Dates. Stored as ISO strings in UTC, formatted only at render.
 * date-fns does the work; this file is the vocabulary the app uses.
 */

import {
  differenceInCalendarDays,
  format,
  isSameDay,
  isSameMonth,
  isSameYear,
  parseISO,
  startOfDay,
} from 'date-fns'

export const nowIso = (): string => new Date().toISOString()

export const toIso = (date: Date): string => date.toISOString()

export const fromIso = (iso: string): Date => parseISO(iso)

/** "Fri 14 Mar" */
export const formatDay = (iso: string): string => format(parseISO(iso), 'EEE d MMM')

/** "14 March 2027" */
export const formatDayLong = (iso: string): string => format(parseISO(iso), 'd MMMM yyyy')

/** "09:40" — 24 hour, because an itinerary read at a glance should not need am/pm. */
export const formatTime = (iso: string): string => format(parseISO(iso), 'HH:mm')

/** "Fri 14 Mar, 09:40" */
export const formatDayTime = (iso: string): string =>
  format(parseISO(iso), 'EEE d MMM, HH:mm')

/** Month key used to group an agenda. */
export const monthKey = (iso: string): string => format(parseISO(iso), 'yyyy-MM')

/** Day key used to group an expense log or agenda. */
export const dayKey = (iso: string): string => format(parseISO(iso), 'yyyy-MM-dd')

/**
 * "14 - 21 Mar 2027", collapsing whatever the two ends share.
 * Returns null when either end is unset, so callers show "dates not set".
 */
export function formatDateRange(startIso: string | null, endIso: string | null): string | null {
  if (!startIso || !endIso) return null
  const start = parseISO(startIso)
  const end = parseISO(endIso)
  if (isSameDay(start, end)) return format(start, 'd MMM yyyy')
  if (isSameMonth(start, end) && isSameYear(start, end)) {
    return `${format(start, 'd')} - ${format(end, 'd MMM yyyy')}`
  }
  if (isSameYear(start, end)) {
    return `${format(start, 'd MMM')} - ${format(end, 'd MMM yyyy')}`
  }
  return `${format(start, 'd MMM yyyy')} - ${format(end, 'd MMM yyyy')}`
}

/**
 * Whole days from today until the trip starts. Negative once it has started,
 * null when no start date is set.
 */
export function daysUntil(iso: string | null): number | null {
  if (!iso) return null
  return differenceInCalendarDays(startOfDay(parseISO(iso)), startOfDay(new Date()))
}

/** True when the trip has begun and not yet ended. */
export function isUnderway(startIso: string | null, endIso: string | null): boolean {
  if (!startIso) return false
  const today = startOfDay(new Date())
  const start = startOfDay(parseISO(startIso))
  if (today < start) return false
  if (!endIso) return true
  return today <= startOfDay(parseISO(endIso))
}
