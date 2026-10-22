/*
 * Editing an expense: what to send. Only what changed is sent, and that matters most for the split.
 * The server reads a missing "split" as "leave it as it is" and a null as "back to everyone, evenly",
 * so a form that restated an untouched split would quietly drop anyone in it who has since left the
 * trip. A split is sent only when the person actually changed it.
 */

import { dayToIso, isoToDay } from '@/lib/dates'
import type { Expense, ExpenseCategory, ExpenseSplit, Profile } from '@/types'

export type ExpenseEditForm = {
  description: string
  category: ExpenseCategory
  paidBy: string
  /** A day picker's value ("2026-11-08"). */
  spentAt: string
}

const sameIds = (a: string[], b: string[]): boolean => {
  const left = new Set(a)
  const right = new Set(b)
  return left.size === right.size && [...left].every((id) => right.has(id))
}

/** What each person owes, without the zeros and the payer's own figure, which the server drops too. */
function owed(amounts: Record<string, number>, paidBy: string): Map<string, number> {
  return new Map(Object.entries(amounts).filter(([id, cents]) => cents > 0 && id !== paidBy))
}

/**
 * Is `next` the same split as `original`? An expense with no split of its own is shared by whoever is
 * on the trip, so it is unchanged exactly when an equal split names every current member.
 */
export function sameSplit(
  original: ExpenseSplit | null,
  next: ExpenseSplit,
  paidBy: string,
  memberIds: string[],
): boolean {
  if (original === null) return next.kind === 'equal' && sameIds(next.userIds, memberIds)
  if (original.kind === 'equal') return next.kind === 'equal' && sameIds(original.userIds, next.userIds)
  if (next.kind !== 'exact') return false
  const before = owed(original.amounts, paidBy)
  const after = owed(next.amounts, paidBy)
  return before.size === after.size && [...before].every(([id, cents]) => after.get(id) === cents)
}

export function expensePatch(
  expense: Expense,
  form: ExpenseEditForm,
  amountCents: number,
  split: ExpenseSplit,
  memberIds: string[],
): Partial<Expense> {
  const patch: Partial<Expense> = {}
  if (form.description.trim() !== expense.description) patch.description = form.description.trim()
  if (amountCents !== expense.amountCents) patch.amountCents = amountCents
  if (form.paidBy !== expense.paidBy) patch.paidBy = form.paidBy
  if (form.category !== expense.category) patch.category = form.category
  if (form.spentAt !== isoToDay(expense.spentAt)) patch.spentAt = dayToIso(form.spentAt)
  if (!sameSplit(expense.split, split, form.paidBy, memberIds)) patch.split = split
  return patch
}

export const LEFT_THE_TRIP = 'Someone who has left the trip'

/** Everyone the expense already names who is no longer on the trip. */
function leaversOf(expense: Expense, memberIds: string[]): string[] {
  const named = [expense.paidBy]
  if (expense.split?.kind === 'equal') named.push(...expense.split.userIds)
  if (expense.split?.kind === 'exact') named.push(...Object.keys(expense.split.amounts))
  return [...new Set(named)].filter((id) => !memberIds.includes(id))
}

/**
 * The people the edit form can show: whoever is on the trip, plus anyone who has left but is still the
 * payer or in the split. They stay in the list so an edit does not silently take them out; nobody new
 * who has left is ever offered.
 */
export function peopleFor(expense: Expense | undefined, members: Profile[]): Profile[] {
  if (!expense) return members
  const leavers = leaversOf(
    expense,
    members.map((m) => m.id),
  ).map((id) => ({ id, displayName: LEFT_THE_TRIP, email: '', avatarHue: 0 }))
  return [...members, ...leavers]
}

export type SplitState = {
  mode: 'equal' | 'exact'
  pickedIds: string[]
  owed: Record<string, number | null>
}

/** The form's starting point for an expense's split. No split of its own means everyone on the trip. */
export function splitStateOf(split: ExpenseSplit | null, memberIds: string[]): SplitState {
  if (split === null) return { mode: 'equal', pickedIds: memberIds, owed: {} }
  if (split.kind === 'equal') return { mode: 'equal', pickedIds: split.userIds, owed: {} }
  return { mode: 'exact', pickedIds: memberIds, owed: { ...split.amounts } }
}
