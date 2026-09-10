import { latency, read, uid, write } from '@/services/mock/db'
import { ApiError, toExpense } from '@/types'
import type { Expense, ExpenseCategory } from '@/types'

export type NewExpense = {
  tripId: string
  description: string
  amountCents: number
  paidBy: string
  spentAt: string
  category: ExpenseCategory
}

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
    if (patch.description !== undefined) expense.description = patch.description
    if (patch.amountCents !== undefined) expense.amount_cents = patch.amountCents
    if (patch.paidBy !== undefined) expense.paid_by = patch.paidBy
    if (patch.spentAt !== undefined) expense.spent_at = patch.spentAt
    if (patch.category !== undefined) expense.category = patch.category
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
