/*
 * The settlement check the build plan asks for: run the real seed through the
 * real maths and assert it reconciles to the cent.
 */

import { describe, expect, it } from 'vitest'
import { computeBalances, settle, sharesFor, totalSpent } from '@/lib/balances'
import { buildSeed } from '@/services/mock/seed'
import { toExpense, toFuelLeg } from '@/types'
import type { Expense, FuelLeg } from '@/types'

const seed = buildSeed()
const expenses: Expense[] = seed.expenses.map(toExpense)
const fuelLegs: FuelLeg[] = seed.fuelLegs.map(toFuelLeg)
const memberIds: string[] = seed.tripMembers.map((m) => m.user_id)

describe('seed data', () => {
  it('has the shape the plan specifies', () => {
    expect(seed.profiles).toHaveLength(5)
    expect(memberIds).toHaveLength(5)
    expect(seed.ideas).toHaveLength(8)
    expect(expenses).toHaveLength(12)
    expect(fuelLegs).toHaveLength(3)
    expect(seed.bookings).toHaveLength(4)
    expect(seed.messages).toHaveLength(20)
  })
})

describe('sharesFor', () => {
  it('splits an ordinary expense across every member', () => {
    const van = expenses.find((e) => e.id === 'exp-van')
    if (!van) throw new Error('seed changed')
    const shares = sharesFor(van, memberIds, fuelLegs)
    expect(shares.size).toBe(5)
    // 78500 / 5 divides exactly.
    for (const share of shares.values()) expect(share).toBe(15_700)
  })

  it('splits a fuel expense across that leg riders only', () => {
    const fuel = expenses.find((e) => e.id === 'exp-fuel-apollo-pc')
    if (!fuel) throw new Error('seed changed')
    const shares = sharesFor(fuel, memberIds, fuelLegs)
    // Mia and Jonas stayed behind, so only three people carry this one.
    expect(shares.size).toBe(3)
    expect([...shares.values()].reduce((a, b) => a + b, 0)).toBe(fuel.amountCents)
    // 3661 / 3 leaves one cent over, which goes to the earliest id.
    expect([...shares.values()].sort((a, b) => b - a)).toEqual([1_221, 1_220, 1_220])
  })

  it('never loses or invents a cent on any expense', () => {
    for (const expense of expenses) {
      const shares = sharesFor(expense, memberIds, fuelLegs)
      const summed = [...shares.values()].reduce((a, b) => a + b, 0)
      expect(summed).toBe(expense.amountCents)
    }
  })
})

describe('computeBalances', () => {
  const balances = computeBalances(expenses, memberIds, fuelLegs)

  it('covers every member', () => {
    expect(balances).toHaveLength(5)
  })

  it('nets to zero across the group', () => {
    const net = balances.reduce((sum, b) => sum + b.netCents, 0)
    expect(net).toBe(0)
  })

  it('accounts for every cent spent', () => {
    const paid = balances.reduce((sum, b) => sum + b.paidCents, 0)
    const owed = balances.reduce((sum, b) => sum + b.owedCents, 0)
    expect(paid).toBe(totalSpent(expenses))
    expect(owed).toBe(totalSpent(expenses))
  })
})

describe('settle', () => {
  const balances = computeBalances(expenses, memberIds, fuelLegs)
  const transfers = settle(balances)

  it('clears every position exactly', () => {
    const after = new Map(balances.map((b) => [b.userId, b.netCents]))
    for (const t of transfers) {
      after.set(t.from, (after.get(t.from) ?? 0) + t.amountCents)
      after.set(t.to, (after.get(t.to) ?? 0) - t.amountCents)
    }
    for (const [, net] of after) expect(net).toBe(0)
  })

  it('never proposes a zero or negative transfer', () => {
    for (const t of transfers) {
      expect(t.amountCents).toBeGreaterThan(0)
      expect(t.from).not.toBe(t.to)
    }
  })

  it('uses no more transfers than it needs', () => {
    const active = balances.filter((b) => b.netCents !== 0).length
    // A greedy pass zeroes at least one position per transfer.
    expect(transfers.length).toBeLessThanOrEqual(Math.max(0, active - 1))
  })

  it('is deterministic', () => {
    expect(settle(computeBalances(expenses, memberIds, fuelLegs))).toEqual(transfers)
  })
})
