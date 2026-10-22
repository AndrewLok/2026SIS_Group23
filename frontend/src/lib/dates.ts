/*
 * Dates. Stored as ISO strings in UTC, formatted only at render. A date that is just a day
 * (a trip's start, when an expense was spent) is stored as noon on that day: see dayToIso.
 * date-fns does the work; this file is the vocabulary the app uses.
 */

import {
  differenceInCalendarDays,
  format,
  isSameDay,
  isSameMonth,
  isSameYear,
  isValid,
  parseISO,
  set,
  startOfDay,
} from 'date-fns'

export const nowIso = (): string => new Date().toISOString()

export const toIso = (date: Date): string => date.toISOString()

export const fromIso = (iso: string): Date => parseISO(iso)

/**
 * Today as the person sees it, "2026-11-08", for a date input's default. Not
 * `new Date().toISOString().slice(0, 10)`, which is today in UTC and so, for anyone
 * whose clock is ahead of or behind UTC, is the wrong day for part of every day.
 */
export const todayAsDay = (): string => format(new Date(), 'yyyy-MM-dd')

/**
 * A calendar day picked in a date input ("2026-11-08") as the instant we store: noon on that day on
 * the picker's own clock. Not `new Date(day).toISOString()`, which reads the day as midnight UTC and
 * so shows up as the day before for anyone west of UTC. Noon is as far from either midnight as it
 * gets, so the same day shows for the picker and for anyone within twelve hours of them.
 */
export function dayToIso(day: string): string {
  const date = parseISO(day)
  if (!isValid(date)) throw new Error(`Not a calendar day: "${day}"`)
  return set(date, { hours: 12, minutes: 0, seconds: 0, milliseconds: 0 }).toISOString()
}

/** An instant as a day-picker shows it ("2026-11-08"), on the viewer's own clock. */
export const isoToDay = (iso: string): string => format(parseISO(iso), 'yyyy-MM-dd')

/** An instant as a date-and-time picker shows it ("2026-11-08T14:30"), on the viewer's own clock. */
export const isoToLocalInput = (iso: string): string => format(parseISO(iso), "yyyy-MM-dd'T'HH:mm")

/** What a date-and-time picker holds ("2026-11-08T14:30") as the instant we store, or null when empty. */
export function localInputToIso(value: string): string | null {
  if (!value) return null
  const date = new Date(value)
  return isValid(date) ? date.toISOString() : null
}

/** "Fri 14 Mar" */
export const formatDay = (iso: string): string => format(parseISO(iso), 'EEE d MMM')

/** "14 March 2027" */
export const formatDayLong = (iso: string): string => format(parseISO(iso), 'd MMMM yyyy')

/** "09:40" — 24 hour, because an itinerary read at a glance should not need am/pm. */
export const formatTime = (iso: string): string => format(parseISO(iso), 'HH:mm')

/** "Fri 14 Mar, 09:40" */
export const formatDayTime = (iso: string): string =>
  format(parseISO(iso), 'EEE d MMM, HH:mm')

/**
 * When an activity happens, in one line: "Fri 14 Mar, 09:40", "Fri 14 Mar, 09:40 to 12:00" (or with
 * the end's own day when it is not the same day), or "Fri 14 Mar, all day". Null when it has no start.
 */
export function formatWhen(
  startIso: string | null,
  endIso: string | null,
  allDay: boolean,
): string | null {
  if (!startIso) return null
  if (allDay) {
    const sameDay = !endIso || dayKey(endIso) === dayKey(startIso)
    return sameDay ? `${formatDay(startIso)}, all day` : `${formatDay(startIso)} to ${formatDay(endIso as string)}, all day`
  }
  if (!endIso) return formatDayTime(startIso)
  return dayKey(endIso) === dayKey(startIso)
    ? `${formatDayTime(startIso)} to ${formatTime(endIso)}`
    : `${formatDayTime(startIso)} to ${formatDayTime(endIso)}`
}

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
