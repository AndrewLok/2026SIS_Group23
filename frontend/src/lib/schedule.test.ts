import { describe, expect, it } from 'vitest'
import { endOf, formatMinutes, freeGaps, layoutDay, overlaps } from '@/lib/schedule'

const H = 60 * 60 * 1000
const span = (start: number, end: number, item = '') => ({ start: start * H, end: end * H, item })

describe('layoutDay', () => {
  it('gives a lone block the full width', () => {
    const [placed] = layoutDay([span(9, 10, 'a')])
    expect(placed).toMatchObject({ column: 0, columns: 1 })
  })

  it('puts overlapping blocks side by side', () => {
    const placed = layoutDay([span(9, 11, 'a'), span(10, 12, 'b')])
    expect(placed.map((p) => [p.item, p.column, p.columns])).toEqual([
      ['a', 0, 2],
      ['b', 1, 2],
    ])
  })

  it('reuses a lane once it is free, and starts a new cluster after a gap', () => {
    const placed = layoutDay([
      span(9, 11, 'a'),
      span(9, 10, 'b'),
      span(10, 11, 'c'),
      span(12, 13, 'd'),
    ])
    const byItem = Object.fromEntries(placed.map((p) => [p.item, p]))
    expect(byItem.c?.column).toBe(1)
    expect(byItem.c?.columns).toBe(2)
    expect(byItem.d).toMatchObject({ column: 0, columns: 1 })
  })
})

describe('freeGaps', () => {
  it('finds the white space between blocks, merging overlaps', () => {
    const gaps = freeGaps([span(9, 11), span(10, 12), span(14, 15)], span(8, 22))
    expect(gaps.map((g) => [g.start / H, g.end / H])).toEqual([
      [8, 9],
      [12, 14],
      [15, 22],
    ])
  })

  it('ignores anything outside the window', () => {
    expect(freeGaps([span(5, 7), span(23, 24)], span(8, 22))).toHaveLength(1)
  })
})

describe('helpers', () => {
  it('draws a block with no end as an hour', () => {
    expect(endOf('2027-01-01T09:00:00Z', null) - Date.parse('2027-01-01T09:00:00Z')).toBe(H)
  })

  it('formats durations', () => {
    expect(formatMinutes(150)).toBe('2h 30m')
    expect(formatMinutes(180)).toBe('3h')
    expect(formatMinutes(45)).toBe('45m')
  })

  it('does not count touching ends as a clash', () => {
    expect(overlaps(span(9, 10), span(10, 11))).toBe(false)
    expect(overlaps(span(9, 11), span(10, 11))).toBe(true)
  })
})
