import { describe, expect, it } from 'vitest'
import { formatMoney, parseMoneyToCents, splitEvenly } from '@/lib/money'

describe('formatMoney', () => {
  it('formats whole and part dollars', () => {
    expect(formatMoney(0)).toBe('$0.00')
    expect(formatMoney(5)).toBe('$0.05')
    expect(formatMoney(4250)).toBe('$42.50')
    expect(formatMoney(123_456)).toBe('$1,234.56')
  })

  it('shows a sign only when asked, but never hides a negative', () => {
    expect(formatMoney(4250, { signed: true })).toBe('+$42.50')
    expect(formatMoney(-4250, { signed: true })).toBe('-$42.50')
    expect(formatMoney(-4250)).toBe('-$42.50')
    expect(formatMoney(0, { signed: true })).toBe('$0.00')
  })
})

describe('parseMoneyToCents', () => {
  it('accepts the shapes people actually type', () => {
    expect(parseMoneyToCents('42')).toBe(4200)
    expect(parseMoneyToCents('42.5')).toBe(4250)
    expect(parseMoneyToCents('42.50')).toBe(4250)
    expect(parseMoneyToCents('$42.50')).toBe(4250)
    expect(parseMoneyToCents('1,234.56')).toBe(123_456)
    expect(parseMoneyToCents(' 42.50 ')).toBe(4250)
  })

  it('rejects what it cannot store exactly', () => {
    expect(parseMoneyToCents('')).toBeNull()
    expect(parseMoneyToCents('abc')).toBeNull()
    expect(parseMoneyToCents('.')).toBeNull()
    expect(parseMoneyToCents('42.505')).toBeNull()
  })
})

describe('splitEvenly', () => {
  it('always sums back to the total', () => {
    for (const total of [0, 1, 99, 100, 4250, 26_240, 36_613]) {
      for (const n of [1, 2, 3, 4, 5, 7]) {
        const parts = splitEvenly(total, n)
        expect(parts).toHaveLength(n)
        expect(parts.reduce((a, b) => a + b, 0)).toBe(total)
      }
    }
  })

  it('gives the remainder cents to the earliest participants', () => {
    expect(splitEvenly(100, 3)).toEqual([34, 33, 33])
    expect(splitEvenly(10, 4)).toEqual([3, 3, 2, 2])
  })
})
