import { describe, expect, it } from 'vitest'
import { budgetFor, spendProgress } from '@/lib/estimate'

describe('budgetFor', () => {
  it('is the estimate when nobody set a cap', () => {
    expect(budgetFor(null, 120_000)).toEqual({ totalCents: 120_000, kind: 'estimate', overCapBy: 0 })
  })

  it('is the cap when there is one, and says how far the estimate is past it', () => {
    expect(budgetFor(100_000, 120_000)).toEqual({ totalCents: 100_000, kind: 'cap', overCapBy: 20_000 })
  })

  it('is not over a cap that the estimate is under, or exactly at', () => {
    expect(budgetFor(150_000, 120_000).overCapBy).toBe(0)
    expect(budgetFor(120_000, 120_000).overCapBy).toBe(0)
  })

  it('treats a cap of nothing as a cap, not as no cap', () => {
    expect(budgetFor(0, 5_000)).toEqual({ totalCents: 0, kind: 'cap', overCapBy: 5_000 })
  })
})

describe('spendProgress', () => {
  it('is a whole percentage, kept inside the bar', () => {
    expect(spendProgress(50, 200)).toBe(25)
    expect(spendProgress(500, 200)).toBe(100)
    expect(spendProgress(10, 0)).toBe(0)
  })
})
