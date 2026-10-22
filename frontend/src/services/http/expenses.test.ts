/*
 * The HTTP expenses client against a stubbed fetch, so no backend has to be running.
 * The fixtures are the shapes the backend's ExpenseFlowTests pin down on the Java side.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as expenses from '@/services/http/expenses'
import { ApiError } from '@/types'

const EXPENSE = {
  id: 'e-1',
  tripId: 'trip-1',
  description: 'Groceries at Colac',
  amountCents: 12345,
  paidBy: 'u-mia',
  spentAt: '2030-06-15T12:00:00Z',
  category: 'food',
  source: 'manual',
  sourceId: null,
  split: null,
  createdBy: 'u-jonas',
  createdAt: '2026-11-01T09:30:00.123456Z',
}
// What the screen gets: the app's Expense type, without the server's creation time.
const { createdAt: _createdAt, ...EXPECTED } = EXPENSE

const NEW = {
  tripId: 'trip-1',
  description: 'Groceries at Colac',
  amountCents: 12345,
  paidBy: 'u-mia',
  spentAt: '2030-06-15T12:00:00.000Z',
  category: 'food' as const,
  split: null,
}

const json = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

const fetchMock = vi.fn<typeof fetch>()

function serve(routes: Record<string, () => Response>): void {
  fetchMock.mockImplementation(async (url, init) => {
    const key = `${init?.method ?? 'GET'} ${String(url)}`
    const route = routes[key]
    if (!route) throw new Error(`Unexpected request: ${key}`)
    return route()
  })
}

const lastCall = () => {
  const [url, init] = fetchMock.mock.calls.at(-1)!
  return {
    url: String(url),
    method: init?.method,
    raw: init?.body ? String(init.body) : undefined,
    body: init?.body ? JSON.parse(String(init.body)) : undefined,
  }
}

async function failure(promise: Promise<unknown>): Promise<ApiError> {
  const error: unknown = await promise.then(
    () => null,
    (e: unknown) => e,
  )
  expect(error).toBeInstanceOf(ApiError)
  return error as ApiError
}

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('listing', () => {
  it('reads a trip’s expenses as the app’s Expense type', async () => {
    serve({ 'GET /api/trips/trip-1/expenses': () => json(200, [EXPENSE]) })

    expect(await expenses.list('trip-1')).toEqual([EXPECTED])
  })

  it('copes with a trip that has none', async () => {
    serve({ 'GET /api/trips/trip-1/expenses': () => json(200, []) })
    expect(await expenses.list('trip-1')).toEqual([])
  })

  it('reads both kinds of split, and copies them', async () => {
    const equal = { kind: 'equal', userIds: ['u-a', 'u-b'] }
    const exact = { kind: 'exact', amounts: { 'u-a': 300, 'u-b': 200 } }
    serve({
      'GET /api/trips/trip-1/expenses': () =>
        json(200, [
          { ...EXPENSE, id: 'e-2', split: equal },
          { ...EXPENSE, id: 'e-3', split: exact },
        ]),
    })

    const [first, second] = await expenses.list('trip-1')
    expect(first?.split).toEqual(equal)
    expect(second?.split).toEqual(exact)
  })

  it('accepts every category the form offers and both sources, and rejects others', async () => {
    for (const category of ['food', 'transport', 'tickets', 'stay', 'other']) {
      serve({ 'GET /api/trips/trip-1/expenses': () => json(200, [{ ...EXPENSE, category }]) })
      expect((await expenses.list('trip-1'))[0]?.category).toBe(category)
    }
    serve({
      'GET /api/trips/trip-1/expenses': () =>
        json(200, [{ ...EXPENSE, source: 'fuel', sourceId: 'leg-1' }]),
    })
    expect((await expenses.list('trip-1'))[0]).toMatchObject({ source: 'fuel', sourceId: 'leg-1' })

    for (const bad of [{ category: 'fun' }, { source: 'other' }]) {
      serve({ 'GET /api/trips/trip-1/expenses': () => json(200, [{ ...EXPENSE, ...bad }]) })
      expect((await failure(expenses.list('trip-1'))).code).toBe('unavailable')
    }
  })

  it('treats an expense of the wrong shape as the server misbehaving', async () => {
    const broken = [
      { ...EXPENSE, id: 5 },
      { ...EXPENSE, amountCents: '123' },
      { ...EXPENSE, amountCents: null },
      { ...EXPENSE, paidBy: null },
      { ...EXPENSE, spentAt: 5 },
      { ...EXPENSE, description: null },
      { ...EXPENSE, sourceId: 7 },
      { ...EXPENSE, createdBy: undefined },
      { ...EXPENSE, split: undefined },
      { ...EXPENSE, split: 'equal' },
      { ...EXPENSE, split: { kind: 'thirds' } },
      { ...EXPENSE, split: { kind: 'equal' } },
      { ...EXPENSE, split: { kind: 'equal', userIds: [1, 2] } },
      { ...EXPENSE, split: { kind: 'exact' } },
      { ...EXPENSE, split: { kind: 'exact', amounts: { 'u-a': '300' } } },
      { ...EXPENSE, split: { kind: 'exact', amounts: ['u-a'] } },
      'text',
      null,
    ]
    for (const item of broken) {
      serve({ 'GET /api/trips/trip-1/expenses': () => json(200, [item]) })
      expect((await failure(expenses.list('trip-1'))).code).toBe('unavailable')
    }
    serve({ 'GET /api/trips/trip-1/expenses': () => json(200, { not: 'a list' }) })
    expect((await failure(expenses.list('trip-1'))).code).toBe('unavailable')
  })

  it('passes on a refusal, and says so when the server cannot be reached', async () => {
    serve({
      'GET /api/trips/trip-1/expenses': () =>
        json(404, { code: 'not_found', message: 'That trip does not exist.' }),
    })
    const refused = await failure(expenses.list('trip-1'))
    expect(refused.code).toBe('not_found')
    expect(refused.message).toBe('That trip does not exist.')

    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    expect((await failure(expenses.list('trip-1'))).code).toBe('unavailable')
  })
})

describe('fuel expenses', () => {
  it('come from the server with everything else, in the order it sent them', async () => {
    // A leg’s expense is written by the server with the leg, so the list is just the server’s list.
    const fuel = { ...EXPENSE, id: 'f-1', source: 'fuel', sourceId: 'leg-1', category: 'transport' }
    const older = { ...EXPENSE, id: 'e-0', spentAt: '2030-06-01T12:00:00Z' }
    serve({ 'GET /api/trips/trip-1/expenses': () => json(200, [fuel, EXPENSE, older]) })

    const list = await expenses.list('trip-1')

    expect(list.map((e) => e.id)).toEqual(['f-1', 'e-1', 'e-0'])
    expect(list[0]).toMatchObject({ source: 'fuel', sourceId: 'leg-1' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

describe('adding', () => {
  it('sends the form’s fields, and returns the expense the server made', async () => {
    serve({ 'POST /api/trips/trip-1/expenses': () => json(201, EXPENSE) })

    expect(await expenses.create(NEW)).toEqual(EXPECTED)
    expect(lastCall().body).toEqual({
      description: 'Groceries at Colac',
      amountCents: 12345,
      paidBy: 'u-mia',
      spentAt: '2030-06-15T12:00:00.000Z',
      category: 'food',
      split: null,
    })
    expect(lastCall().body).not.toHaveProperty('tripId')
  })

  it('sends a split as the server reads it', async () => {
    serve({ 'POST /api/trips/trip-1/expenses': () => json(201, EXPENSE) })

    await expenses.create({ ...NEW, split: { kind: 'equal', userIds: ['u-a', 'u-b'] } })
    expect(lastCall().body.split).toEqual({ kind: 'equal', userIds: ['u-a', 'u-b'] })

    await expenses.create({ ...NEW, split: { kind: 'exact', amounts: { 'u-a': 300 } } })
    expect(lastCall().body.split).toEqual({ kind: 'exact', amounts: { 'u-a': 300 } })
  })

  it('shows the server’s message when it refuses', async () => {
    serve({
      'POST /api/trips/trip-1/expenses': () =>
        json(400, { code: 'invalid', message: 'What people owe adds up to more than the total.' }),
    })

    const error = await failure(expenses.create(NEW))
    expect(error.code).toBe('invalid')
    expect(error.message).toBe('What people owe adds up to more than the total.')
  })

  it('puts a trip id with odd characters safely in the address', async () => {
    serve({ 'POST /api/trips/a%2Fb/expenses': () => json(201, EXPENSE) })

    await expenses.create({ ...NEW, tripId: 'a/b' })
  })
})

describe('changing', () => {
  it('sends only what changed, and keeps null for "back to everyone"', async () => {
    serve({ 'PATCH /api/expenses/e-1': () => json(200, EXPENSE) })

    await expenses.update('e-1', { description: 'Dinner' })
    expect(lastCall().body).toEqual({ description: 'Dinner' })

    await expenses.update('e-1', { split: null })
    expect(lastCall().raw).toBe('{"split":null}')
  })

  it('leaves out what is fixed, even if the patch carries it', async () => {
    serve({ 'PATCH /api/expenses/e-1': () => json(200, EXPENSE) })

    await expenses.update('e-1', {
      description: 'Dinner',
      tripId: 'trip-9',
      createdBy: 'u-x',
      source: 'fuel',
      sourceId: 'leg-9',
      id: 'e-9',
    })

    expect(lastCall().body).toEqual({ description: 'Dinner' })
  })

  it('shows the server’s message when it refuses', async () => {
    serve({
      'PATCH /api/expenses/e-1': () =>
        json(403, { code: 'forbidden', message: 'This came from a fuel leg. Edit the leg and this updates with it.' }),
    })

    const error = await failure(expenses.update('e-1', { description: 'x' }))
    expect(error.code).toBe('forbidden')
    expect(error.message).toContain('fuel leg')
  })
})

describe('deleting', () => {
  it('deletes by id and returns nothing', async () => {
    serve({ 'DELETE /api/expenses/e-1': () => new Response(null, { status: 204 }) })

    await expect(expenses.remove('e-1')).resolves.toBeUndefined()
    expect(lastCall().method).toBe('DELETE')
  })

  it('says so when it is already gone, or not yours to delete', async () => {
    serve({
      'DELETE /api/expenses/e-1': () =>
        json(404, { code: 'not_found', message: 'That expense has been deleted.' }),
    })
    expect((await failure(expenses.remove('e-1'))).code).toBe('not_found')

    serve({
      'DELETE /api/expenses/e-1': () =>
        json(403, { code: 'forbidden', message: 'Only the person who added this can delete it.' }),
    })
    expect((await failure(expenses.remove('e-1'))).code).toBe('forbidden')
  })
})
