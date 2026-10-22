/*
 * Expenses against the Spring backend (/api/trips/{id}/expenses, /api/expenses/{id}), with the same
 * signatures as services/mock/expenses.ts so client.ts can swap one for the other.
 *
 * What the server decides: that the person who paid and everyone in a split are on the trip, that
 * what people owe is not more than the total, and who may change or delete one (the person who
 * typed it in, the person who paid, or the trip owner). Balances are not stored anywhere: the
 * screen works them out from this list (lib/balances.ts).
 *
 * An expense written by a fuel leg comes in the same list (source "fuel"). The server writes it with
 * the leg and refuses any change to it here; the leg is the thing to edit.
 */

import {
  isNumber,
  isRecord,
  isString,
  isStringOrNull,
  readJson,
  request,
  UNEXPECTED_MESSAGE,
} from '@/services/http/request'
import type { NewExpense } from '@/services/mock/expenses'
import { ApiError } from '@/types'
import type { Expense, ExpenseCategory, ExpenseSource, ExpenseSplit } from '@/types'

const unexpected = (): ApiError => new ApiError('unavailable', UNEXPECTED_MESSAGE)

const CATEGORIES: ReadonlyArray<string> = ['food', 'transport', 'tickets', 'stay', 'other']
const SOURCES: ReadonlyArray<string> = ['manual', 'fuel']

function parseSplit(data: unknown): ExpenseSplit | null {
  if (data === null) return null
  if (!isRecord(data)) throw unexpected()
  if (data.kind === 'equal') {
    const ids = data.userIds
    if (!Array.isArray(ids) || !ids.every(isString)) throw unexpected()
    return { kind: 'equal', userIds: [...ids] }
  }
  if (data.kind === 'exact') {
    const amounts = data.amounts
    if (!isRecord(amounts) || Array.isArray(amounts)) throw unexpected()
    const copy: Record<string, number> = {}
    for (const [id, cents] of Object.entries(amounts)) {
      if (!isNumber(cents)) throw unexpected()
      copy[id] = cents
    }
    return { kind: 'exact', amounts: copy }
  }
  throw unexpected()
}

function parseExpense(data: unknown): Expense {
  if (
    !isRecord(data) ||
    !isString(data.id) ||
    !isString(data.tripId) ||
    !isString(data.description) ||
    !isNumber(data.amountCents) ||
    !isString(data.paidBy) ||
    !isString(data.spentAt) ||
    !isString(data.category) ||
    !CATEGORIES.includes(data.category) ||
    !isString(data.source) ||
    !SOURCES.includes(data.source) ||
    !isStringOrNull(data.sourceId) ||
    !isStringOrNull(data.createdBy) ||
    data.split === undefined
  ) {
    throw unexpected()
  }
  return {
    id: data.id,
    tripId: data.tripId,
    description: data.description,
    amountCents: data.amountCents,
    paidBy: data.paidBy,
    spentAt: data.spentAt,
    category: data.category as ExpenseCategory,
    source: data.source as ExpenseSource,
    sourceId: data.sourceId,
    split: parseSplit(data.split),
    createdBy: data.createdBy,
  }
}

const expensePath = (expenseId: string): string => `/expenses/${encodeURIComponent(expenseId)}`

/** Newest spending first, fuel included, in the order the server sends it. */
export async function list(tripId: string): Promise<Expense[]> {
  const response = await request('GET', `/trips/${encodeURIComponent(tripId)}/expenses`)
  const data = await readJson(response)
  if (!Array.isArray(data)) throw unexpected()
  return data.map(parseExpense)
}

export async function create(input: NewExpense): Promise<Expense> {
  const response = await request('POST', `/trips/${encodeURIComponent(input.tripId)}/expenses`, {
    description: input.description,
    amountCents: input.amountCents,
    paidBy: input.paidBy,
    spentAt: input.spentAt,
    category: input.category,
    split: input.split,
  })
  return parseExpense(await readJson(response))
}

/**
 * Only these can be changed this way. Which trip it is on, who typed it in and where it came from
 * are fixed, so they are left out of the request even if the patch carries them.
 */
export async function update(expenseId: string, patch: Partial<Expense>): Promise<Expense> {
  const body = {
    description: patch.description,
    amountCents: patch.amountCents,
    paidBy: patch.paidBy,
    spentAt: patch.spentAt,
    category: patch.category,
    split: patch.split,
  }
  // JSON leaves out what is undefined and keeps what is null, which is the difference between
  // "leave it alone" and "back to everyone, evenly" that the server relies on.
  const response = await request('PATCH', expensePath(expenseId), body)
  return parseExpense(await readJson(response))
}

export async function remove(expenseId: string): Promise<void> {
  await request('DELETE', expensePath(expenseId))
}
