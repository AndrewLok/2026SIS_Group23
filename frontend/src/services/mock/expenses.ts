import { latency, read, uid, write } from '@/services/mock/db'
import { ApiError, fromExpenseSplit, toExpense } from '@/types'
import type { Expense, ExpenseCategory, ExpenseSplit } from '@/types'

export type NewExpense = {
  tripId: string
  description: string
  amountCents: number
  paidBy: string
  spentAt: string
  category: ExpenseCategory
  /** Null splits evenly across everyone on the trip. */
  split: ExpenseSplit | null
}

/**
 * Check a split against its expense and return it in its stored shape.
 *
 * An exact split drops zero amounts and any figure against the payer, since the
 * payer's share is always whatever is left over. The amounts owed can never add
 * up to more than the total, or the payer would end up owing themselves.
 */
function checkedSplit(
  split: ExpenseSplit | null,
  amountCents: number,
  paidBy: string,
  memberIds: Set<string>,
): ExpenseSplit | null {
  if (split === null) return null

  if (split.kind === 'equal') {
    const userIds = [...new Set(split.userIds)]
    if (userIds.length === 0) throw new ApiError('invalid', 'Pick at least one person to split it with.')
    if (userIds.some((id) => !memberIds.has(id))) {
      throw new ApiError('invalid', 'Everyone sharing it has to be on the trip.')
    }
    return { kind: 'equal', userIds }
  }

  const amounts: Record<string, number> = {}
  let owed = 0
  for (const [id, cents] of Object.entries(split.amounts)) {
    if (!Number.isInteger(cents) || cents < 0) {
      throw new ApiError('invalid', 'Amounts owed must be zero or more.')
    }
    if (id === paidBy || cents === 0) continue
    if (!memberIds.has(id)) throw new ApiError('invalid', 'Everyone who owes has to be on the trip.')
    amounts[id] = cents
    owed += cents
  }
  if (owed === 0) throw new ApiError('invalid', 'Enter what at least one person owes.')
  if (owed > amountCents) {
    throw new ApiError('invalid', 'What people owe adds up to more than the total.')
  }
  return { kind: 'exact', amounts }
}

const tripMemberIds = (tripId: string): Set<string> =>
  new Set(
    read()
      .tripMembers.filter((m) => m.trip_id === tripId)
      .map((m) => m.user_id),
  )

const splitMemberIds = (split: ExpenseSplit | null): string[] =>
  split === null ? [] : split.kind === 'equal' ? split.userIds : Object.keys(split.amounts)

export async function list(tripId: string): Promise<Expense[]> {
  await latency()
  return read()
    .expenses.filter((e) => e.trip_id === tripId)
    .map(toExpense)
    .sort((a, b) => b.spentAt.localeCompare(a.spentAt))
}

export async function create(input: NewExpense): Promise<Expense> {
  await latency()
  if (!input.description.trim()) throw new ApiError('invalid', 'Say what the money went on.')
  if (input.amountCents <= 0) throw new ApiError('invalid', 'Enter an amount above zero.')
  const split = checkedSplit(
    input.split,
    input.amountCents,
    input.paidBy,
    tripMemberIds(input.tripId),
  )
  const row = write((draft) => {
    const expense = {
      id: uid(),
      trip_id: input.tripId,
      description: input.description.trim(),
      amount_cents: input.amountCents,
      paid_by: input.paidBy,
      spent_at: input.spentAt,
      category: input.category,
      source: 'manual' as const,
      source_id: null,
      split: split ? fromExpenseSplit(split) : null,
    }
    draft.expenses.push(expense)
    return expense
  })
  return toExpense(row)
}

export async function update(expenseId: string, patch: Partial<Expense>): Promise<Expense> {
  await latency()
  const row = write((draft) => {
    const expense = draft.expenses.find((e) => e.id === expenseId)
    if (!expense) throw new ApiError('not_found', 'That expense has been deleted.')
    if (expense.source === 'fuel') {
      throw new ApiError(
        'forbidden',
        'This came from a fuel leg. Edit the leg and this updates with it.',
      )
    }
    // The split is checked against the expense as it will be after the patch,
    // so lowering the total below what people owe is refused too. Someone
    // already in the split who has since left still owes their part.
    const current = toExpense(expense)
    const next = { ...current, ...patch }
    const allowed = tripMemberIds(expense.trip_id)
    for (const id of splitMemberIds(current.split)) allowed.add(id)
    const split = checkedSplit(next.split, next.amountCents, next.paidBy, allowed)
    if (patch.description !== undefined) expense.description = patch.description
    if (patch.amountCents !== undefined) expense.amount_cents = patch.amountCents
    if (patch.paidBy !== undefined) expense.paid_by = patch.paidBy
    if (patch.spentAt !== undefined) expense.spent_at = patch.spentAt
    if (patch.category !== undefined) expense.category = patch.category
    expense.split = split ? fromExpenseSplit(split) : null
    return expense
  })
  return toExpense(row)
}

export async function remove(expenseId: string): Promise<void> {
  await latency()
  write((draft) => {
    const expense = draft.expenses.find((e) => e.id === expenseId)
    if (expense?.source === 'fuel') {
      throw new ApiError(
        'forbidden',
        'This came from a fuel leg. Delete the leg to remove it.',
      )
    }
    draft.expenses = draft.expenses.filter((e) => e.id !== expenseId)
  })
}
