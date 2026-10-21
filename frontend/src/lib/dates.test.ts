/*
 * Dates are checked in several time zones, because "it shows the wrong day" only happens for some
 * people some of the time, and a test run in one zone proves nothing about the others. Node honours
 * a change to the TZ environment variable straight away, so each case sets the zone it is about.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { dayKey, dayToIso, daysUntil, formatDateRange, formatDay, todayAsDay } from '@/lib/dates'

const inZone = (zone: string): void => {
  vi.stubEnv('TZ', zone)
}

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

// Across the world's clocks, including both ends: Auckland is +13 in November, Honolulu is -10.
const ZONES = [
  'UTC',
  'Australia/Sydney',
  'Pacific/Auckland',
  'Asia/Kolkata',
  'Europe/London',
  'America/New_York',
  'America/Los_Angeles',
  'Pacific/Honolulu',
]

describe('dayToIso', () => {
  it.each(ZONES)('shows the day that was picked, in %s', (zone) => {
    inZone(zone)

    const iso = dayToIso('2026-11-08')

    expect(dayKey(iso)).toBe('2026-11-08')
    expect(formatDay(iso)).toBe('Sun 8 Nov')
  })

  it.each(ZONES)('keeps a trip range together in %s', (zone) => {
    inZone(zone)

    expect(formatDateRange(dayToIso('2026-11-08'), dayToIso('2026-11-15'))).toBe('8 - 15 Nov 2026')
  })

  it('is noon on the picker clock, which is what keeps neighbouring time zones on the same day', () => {
    inZone('Australia/Sydney')

    // Noon in Sydney (UTC+11 on this date) is 01:00 UTC.
    expect(dayToIso('2026-11-08')).toBe('2026-11-08T01:00:00.000Z')
  })

  it('shows the same day to a viewer a few hours away', () => {
    inZone('Australia/Sydney')
    const iso = dayToIso('2026-11-08')

    inZone('Asia/Tokyo')
    expect(dayKey(iso)).toBe('2026-11-08')
    inZone('Asia/Kolkata')
    expect(dayKey(iso)).toBe('2026-11-08')
    inZone('Pacific/Auckland')
    expect(dayKey(iso)).toBe('2026-11-08')
  })

  it('is what the old midnight-UTC conversion was not', () => {
    inZone('America/Los_Angeles')

    // The old way, `new Date('2026-11-08').toISOString()`, reads the day as midnight UTC, which
    // is the evening of the 7th in Los Angeles. That is the bug this replaces.
    expect(dayKey(new Date('2026-11-08').toISOString())).toBe('2026-11-07')
    expect(dayKey(dayToIso('2026-11-08'))).toBe('2026-11-08')
  })

  it('counts days until a trip from the day picked', () => {
    inZone('America/Los_Angeles')
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-01T20:00:00-08:00'))

    expect(daysUntil(dayToIso('2026-11-08'))).toBe(7)
  })

  it('refuses something that is not a day, rather than producing an invalid date', () => {
    expect(() => dayToIso('')).toThrow('Not a calendar day')
    expect(() => dayToIso('next tuesday')).toThrow('Not a calendar day')
  })
})

describe('todayAsDay', () => {
  it('is today on the person\'s own clock, not today in UTC', () => {
    inZone('Australia/Sydney')
    vi.useFakeTimers()
    // 9:30 on the morning of the 9th in Sydney, which is still the 8th in UTC.
    vi.setSystemTime(new Date('2026-11-09T09:30:00+11:00'))

    expect(todayAsDay()).toBe('2026-11-09')
    expect(new Date().toISOString().slice(0, 10)).toBe('2026-11-08') // what the old default gave
  })

  it('does the same on the other side of the world', () => {
    inZone('America/Los_Angeles')
    vi.useFakeTimers()
    // 9pm on the 8th in Los Angeles, which is already the 9th in UTC.
    vi.setSystemTime(new Date('2026-11-08T21:00:00-08:00'))

    expect(todayAsDay()).toBe('2026-11-08')
    expect(new Date().toISOString().slice(0, 10)).toBe('2026-11-09') // what the old default gave
  })

  it('is a value a date input accepts', () => {
    expect(todayAsDay()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
