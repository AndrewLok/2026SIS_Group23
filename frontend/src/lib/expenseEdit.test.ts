import { describe, expect, it } from 'vitest'
import { LEFT_THE_TRIP, expensePatch, peopleFor, sameSplit, splitStateOf } from '@/lib/expenseEdit'
import { dayToIso } from '@/lib/dates'
import type { Expense, ExpenseSplit } from '@/types'

const MEMBERS = ['u-priya', 'u-jonas', 'u-mia']

const EXPENSE: Expense = {
  id: 'e-1',
  tripId: 't-1',
  description: 'Groceries',
  amountCents: 9000,
  paidBy: 'u-priya',
  spentAt: dayToIso('2030-06-15'),
  category: 'food',
  source: 'manual',
  sourceId: null,
  split: null,
  createdBy: 'u-jonas',
}

const FORM = { description: 'Groceries', category: 'food' as const, paidBy: 'u-priya', spentAt: '2030-06-15' }
const EVERYONE: ExpenseSplit = { kind: 'equal', userIds: MEMBERS }

describe('is it the same split', () => {
  it('treats "no split" and an equal split of everyone on the trip as the same', () => {
    expect(sameSplit(null, EVERYONE, 'u-priya', MEMBERS)).toBe(true)
    expect(sameSplit(null, { kind: 'equal', userIds: ['u-mia', 'u-jonas', 'u-priya'] }, 'u-priya', MEMBERS)).toBe(true)
  })

  it('treats no split as changed once anyone is left out or put in who is not on the trip', () => {
    expect(sameSplit(null, { kind: 'equal', userIds: ['u-priya', 'u-jonas'] }, 'u-priya', MEMBERS)).toBe(false)
    expect(sameSplit(null, { kind: 'equal', userIds: [...MEMBERS, 'u-gone'] }, 'u-priya', MEMBERS)).toBe(false)
    expect(sameSplit(null, { kind: 'exact', amounts: { 'u-jonas': 100 } }, 'u-priya', MEMBERS)).toBe(false)
  })

  it('compares an equal split by who is in it, in any order, leavers included', () => {
    const original: ExpenseSplit = { kind: 'equal', userIds: ['u-priya', 'u-gone'] }
    expect(sameSplit(original, { kind: 'equal', userIds: ['u-gone', 'u-priya'] }, 'u-priya', MEMBERS)).toBe(true)
    expect(sameSplit(original, { kind: 'equal', userIds: ['u-priya'] }, 'u-priya', MEMBERS)).toBe(false)
    expect(sameSplit(original, { kind: 'exact', amounts: { 'u-gone': 100 } }, 'u-priya', MEMBERS)).toBe(false)
  })

  it('compares exact amounts by what each person owes, ignoring zeros and the payer’s own figure', () => {
    const original: ExpenseSplit = { kind: 'exact', amounts: { 'u-jonas': 3000, 'u-gone': 1000 } }
    expect(sameSplit(original, { kind: 'exact', amounts: { 'u-gone': 1000, 'u-jonas': 3000 } }, 'u-priya', MEMBERS)).toBe(true)
    expect(sameSplit(original, { kind: 'exact', amounts: { 'u-jonas': 3000, 'u-gone': 1000, 'u-mia': 0, 'u-priya': 500 } }, 'u-priya', MEMBERS)).toBe(true)
    expect(sameSplit(original, { kind: 'exact', amounts: { 'u-jonas': 3000 } }, 'u-priya', MEMBERS)).toBe(false)
    expect(sameSplit(original, { kind: 'exact', amounts: { 'u-jonas': 3001, 'u-gone': 1000 } }, 'u-priya', MEMBERS)).toBe(false)
    expect(sameSplit(original, EVERYONE, 'u-priya', MEMBERS)).toBe(false)
  })
})

describe('the patch for an expense', () => {
  it('is empty when nothing changed, including a split nobody touched', () => {
    expect(expensePatch(EXPENSE, FORM, 9000, EVERYONE, MEMBERS)).toEqual({})
  })

  it('is only the field that changed', () => {
    expect(expensePatch(EXPENSE, { ...FORM, description: 'Food' }, 9000, EVERYONE, MEMBERS)).toEqual({ description: 'Food' })
    expect(expensePatch(EXPENSE, FORM, 9500, EVERYONE, MEMBERS)).toEqual({ amountCents: 9500 })
    expect(expensePatch(EXPENSE, { ...FORM, category: 'other' }, 9000, EVERYONE, MEMBERS)).toEqual({ category: 'other' })
    expect(expensePatch(EXPENSE, { ...FORM, paidBy: 'u-mia' }, 9000, EVERYONE, MEMBERS)).toEqual({ paidBy: 'u-mia' })
  })

  it('ignores stray spaces around the description', () => {
    expect(expensePatch(EXPENSE, { ...FORM, description: '  Groceries ' }, 9000, EVERYONE, MEMBERS)).toEqual({})
  })

  it('sends a new day as the instant the app stores', () => {
    expect(expensePatch(EXPENSE, { ...FORM, spentAt: '2030-06-16' }, 9000, EVERYONE, MEMBERS)).toEqual({
      spentAt: dayToIso('2030-06-16'),
    })
  })

  it('sends the split only when it changed, and then in full', () => {
    const fewer: ExpenseSplit = { kind: 'equal', userIds: ['u-priya', 'u-jonas'] }
    expect(expensePatch(EXPENSE, FORM, 9000, fewer, MEMBERS)).toEqual({ split: fewer })
    const exact: ExpenseSplit = { kind: 'exact', amounts: { 'u-jonas': 3000 } }
    expect(expensePatch(EXPENSE, FORM, 9000, exact, MEMBERS)).toEqual({ split: exact })
  })

  it('keeps a split that names someone who has left when nothing about it changed', () => {
    const withLeaver: Expense = { ...EXPENSE, split: { kind: 'equal', userIds: ['u-priya', 'u-gone'] } }
    const unchanged: ExpenseSplit = { kind: 'equal', userIds: ['u-gone', 'u-priya'] }
    expect(expensePatch(withLeaver, { ...FORM, description: 'Food' }, 9000, unchanged, MEMBERS)).toEqual({ description: 'Food' })
  })

  it('never sends who added it, where it came from, or the trip', () => {
    const patch = expensePatch(EXPENSE, { ...FORM, description: 'x', category: 'other' }, 1, { kind: 'equal', userIds: ['u-priya'] }, MEMBERS)
    for (const key of ['createdBy', 'source', 'sourceId', 'tripId', 'id']) expect(patch).not.toHaveProperty(key)
  })
})

describe('who the edit form shows', () => {
  const profiles = MEMBERS.map((id) => ({ id, displayName: id, email: '', avatarHue: 0 }))

  it('is just the members when adding', () => {
    expect(peopleFor(undefined, profiles)).toEqual(profiles)
  })

  it('is just the members when nobody named has left', () => {
    expect(peopleFor(EXPENSE, profiles)).toEqual(profiles)
  })

  it('adds a leaver who paid or is in the split, once, without a name', () => {
    const paidByLeaver: Expense = { ...EXPENSE, paidBy: 'u-gone', split: { kind: 'equal', userIds: ['u-gone', 'u-priya'] } }
    const people = peopleFor(paidByLeaver, profiles)
    expect(people.map((p) => p.id)).toEqual([...MEMBERS, 'u-gone'])
    expect(people[3]?.displayName).toBe(LEFT_THE_TRIP)
    const exact: Expense = { ...EXPENSE, split: { kind: 'exact', amounts: { 'u-gone': 100 } } }
    expect(peopleFor(exact, profiles).map((p) => p.id)).toEqual([...MEMBERS, 'u-gone'])
  })
})

describe('the form’s starting split', () => {
  it('is everyone on the trip, evenly, when there is no split of its own', () => {
    expect(splitStateOf(null, MEMBERS)).toEqual({ mode: 'equal', pickedIds: MEMBERS, owed: {} })
  })

  it('is the people in an equal split, leavers included', () => {
    expect(splitStateOf({ kind: 'equal', userIds: ['u-gone', 'u-mia'] }, MEMBERS)).toEqual({
      mode: 'equal',
      pickedIds: ['u-gone', 'u-mia'],
      owed: {},
    })
  })

  it('is the amounts of an exact split, with everyone ticked for if it is switched to equal', () => {
    expect(splitStateOf({ kind: 'exact', amounts: { 'u-jonas': 300 } }, MEMBERS)).toEqual({
      mode: 'exact',
      pickedIds: MEMBERS,
      owed: { 'u-jonas': 300 },
    })
  })
})
