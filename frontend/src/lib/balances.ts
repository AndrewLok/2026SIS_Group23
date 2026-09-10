/*
 * Expense splitting and settlement. Pure functions, no React, no service calls.
 *
 * The four rules this file implements, from the build plan:
 *   1. Each participant owes amount / participants, with the remainder cents
 *      given to the first participants in id order, so totals always reconcile.
 *   2. Net per member is total paid minus total owed.
 *   3. Settlement is a greedy pass, largest creditor against largest debtor.
 *   4. Participants are all trip members, except fuel-sourced expenses, which
 *      use the originating leg's riders.
 */

import { splitEvenly } from '@/lib/money'
import type { Expense, FuelLeg } from '@/types'

export type Transfer = {
  from: string
  to: string
  amountCents: number
}

export type MemberBalance = {
  userId: string
  paidCents: number
  owedCents: number
  /** paid minus owed. Positive means the group owes them. */
  netCents: number
}

/**
 * Who shares this expense. Everyone, unless it came from a fuel leg, in which
 * case only that leg's riders do. A fuel expense whose leg has been deleted
 * falls back to the whole group rather than vanishing from the ledger.
 */
export function participantsFor(
  expense: Expense,
  memberIds: string[],
  fuelLegs: FuelLeg[],
): string[] {
  if (expense.source === 'fuel' && expense.sourceId) {
    const leg = fuelLegs.find((l) => l.id === expense.sourceId)
    if (leg && leg.riderIds.length > 0) {
      return [...leg.riderIds].sort()
    }
  }
  return [...memberIds].sort()
}

/**
 * What each participant owes on one expense, keyed by user id.
 * Sorting the ids first is what makes the remainder allocation stable: the same
 * expense always splits the same way, so a re-render never moves a cent.
 */
export function sharesFor(
  expense: Expense,
  memberIds: string[],
  fuelLegs: FuelLeg[],
): Map<string, number> {
  const participants = participantsFor(expense, memberIds, fuelLegs)
  const parts = splitEvenly(expense.amountCents, participants.length)
  const shares = new Map<string, number>()
  participants.forEach((id, index) => {
    shares.set(id, parts[index] ?? 0)
  })
  return shares
}

/** One member's share of one expense, or 0 when they are not a participant. */
export function shareForMember(
  expense: Expense,
  userId: string,
  memberIds: string[],
  fuelLegs: FuelLeg[],
): number {
  return sharesFor(expense, memberIds, fuelLegs).get(userId) ?? 0
}

/**
 * Paid, owed and net for everyone the ledger touches. Members with no activity
 * still appear.
 *
 * The returned list is deliberately wider than the current member list: someone
 * who has left the trip stops sharing costs, but is still owed whatever they
 * already paid for. Returning only current members loses their money from the
 * netting, and the settlement it feeds then proposes transfers that never clear.
 * Splitting still uses current members only, which is what the removal confirm
 * dialog warns about when it states the new per-head figure.
 */
export function computeBalances(
  expenses: Expense[],
  memberIds: string[],
  fuelLegs: FuelLeg[],
): MemberBalance[] {
  const paid = new Map<string, number>()
  const owed = new Map<string, number>()
  const involved: string[] = []

  const include = (id: string) => {
    if (paid.has(id)) return
    paid.set(id, 0)
    owed.set(id, 0)
    involved.push(id)
  }

  for (const id of memberIds) include(id)

  for (const expense of expenses) {
    include(expense.paidBy)
    paid.set(expense.paidBy, (paid.get(expense.paidBy) ?? 0) + expense.amountCents)
    const shares = sharesFor(expense, memberIds, fuelLegs)
    for (const [userId, share] of shares) {
      include(userId)
      owed.set(userId, (owed.get(userId) ?? 0) + share)
    }
  }

  return involved.map((userId) => {
    const paidCents = paid.get(userId) ?? 0
    const owedCents = owed.get(userId) ?? 0
    return { userId, paidCents, owedCents, netCents: paidCents - owedCents }
  })
}

/**
 * Reduce balances to the fewest practical transfers.
 *
 * Greedy: the largest debtor pays the largest creditor as much as the smaller
 * of the two positions allows, then both shrink and the pass repeats. Ties break
 * on user id so the same balances always produce the same list.
 */
export function settle(balances: MemberBalance[]): Transfer[] {
  const byMagnitude = (a: { amount: number; id: string }, b: { amount: number; id: string }) =>
    b.amount - a.amount || a.id.localeCompare(b.id)

  const creditors = balances
    .filter((b) => b.netCents > 0)
    .map((b) => ({ id: b.userId, amount: b.netCents }))
    .sort(byMagnitude)

  const debtors = balances
    .filter((b) => b.netCents < 0)
    .map((b) => ({ id: b.userId, amount: -b.netCents }))
    .sort(byMagnitude)

  const transfers: Transfer[] = []
  let c = 0
  let d = 0

  while (c < creditors.length && d < debtors.length) {
    const creditor = creditors[c]
    const debtor = debtors[d]
    if (!creditor || !debtor) break

    const amount = Math.min(creditor.amount, debtor.amount)
    if (amount > 0) {
      transfers.push({ from: debtor.id, to: creditor.id, amountCents: amount })
      creditor.amount -= amount
      debtor.amount -= amount
    }
    if (creditor.amount === 0) c += 1
    if (debtor.amount === 0) d += 1
  }

  return transfers
}

/** Only the transfers the given member is part of, for the privacy setting. */
export function transfersInvolving(transfers: Transfer[], userId: string): Transfer[] {
  return transfers.filter((t) => t.from === userId || t.to === userId)
}

/** Total spent on the trip, across every expense. */
export function totalSpent(expenses: Expense[]): number {
  return expenses.reduce((sum, e) => sum + e.amountCents, 0)
}
