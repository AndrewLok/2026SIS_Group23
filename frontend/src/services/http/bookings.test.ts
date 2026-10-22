/*
 * The HTTP bookings client against a stubbed fetch, so no backend has to be running.
 * The fixtures are the shapes the backend's BookingFlowTests pin down on the Java side.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as bookings from '@/services/http/bookings'
import { ApiError } from '@/types'

const BOOKING = {
  id: 'b-1',
  tripId: 'trip-1',
  type: 'flight',
  title: 'JQ 610 BNE to MEL',
  provider: 'Jetstar',
  reference: 'K4RT2W',
  startsAt: '2030-06-15T12:30:00Z',
  endsAt: null,
  origin: 'BNE',
  destination: 'MEL',
  costCents: 21500,
  belongsTo: 'u-jonas',
  notes: 'window',
  createdBy: 'u-jonas',
  createdAt: '2026-11-01T09:30:00.123456Z',
}
// What the screen gets: the app's Booking type, without the server's creation time.
const { createdAt: _createdAt, ...EXPECTED } = BOOKING

const NEW = {
  tripId: 'trip-1',
  type: 'flight' as const,
  title: 'JQ 610 BNE to MEL',
  provider: 'Jetstar',
  reference: 'K4RT2W',
  startsAt: '2030-06-15T12:30:00.000Z',
  endsAt: null,
  origin: 'BNE',
  destination: 'MEL',
  costCents: 21500,
  belongsTo: 'u-jonas',
  notes: 'window',
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
  it('reads a trip’s bookings as the app’s Booking type', async () => {
    serve({ 'GET /api/trips/trip-1/bookings': () => json(200, [BOOKING]) })

    expect(await bookings.list('trip-1')).toEqual([EXPECTED])
  })

  it('copes with a trip that has none, and with a booking nobody is recorded for', async () => {
    serve({ 'GET /api/trips/trip-1/bookings': () => json(200, []) })
    expect(await bookings.list('trip-1')).toEqual([])

    serve({
      'GET /api/trips/trip-1/bookings': () =>
        json(200, [{ ...BOOKING, startsAt: null, costCents: null, belongsTo: null, createdBy: null }]),
    })
    expect(await bookings.list('trip-1')).toEqual([
      { ...EXPECTED, startsAt: null, costCents: null, belongsTo: null, createdBy: null },
    ])
  })

  it('accepts every type the form offers, and rejects one it does not', async () => {
    for (const type of ['flight', 'stay', 'car', 'other']) {
      serve({ 'GET /api/trips/trip-1/bookings': () => json(200, [{ ...BOOKING, type }]) })
      expect((await bookings.list('trip-1'))[0]?.type).toBe(type)
    }
    serve({ 'GET /api/trips/trip-1/bookings': () => json(200, [{ ...BOOKING, type: 'boat' }]) })
    expect((await failure(bookings.list('trip-1'))).code).toBe('unavailable')
  })

  it('treats a booking of the wrong shape as the server misbehaving', async () => {
    const broken = [
      { ...BOOKING, id: 5 },
      { ...BOOKING, costCents: '215' },
      { ...BOOKING, costCents: undefined },
      { ...BOOKING, startsAt: 5 },
      { ...BOOKING, belongsTo: 5 },
      { ...BOOKING, title: null },
      { ...BOOKING, createdBy: undefined },
      'text',
      null,
    ]
    for (const item of broken) {
      serve({ 'GET /api/trips/trip-1/bookings': () => json(200, [item]) })
      expect((await failure(bookings.list('trip-1'))).code).toBe('unavailable')
    }
    serve({ 'GET /api/trips/trip-1/bookings': () => json(200, { not: 'a list' }) })
    expect((await failure(bookings.list('trip-1'))).code).toBe('unavailable')
  })

  it('passes on a refusal, and says so when the server cannot be reached', async () => {
    serve({
      'GET /api/trips/trip-1/bookings': () =>
        json(404, { code: 'not_found', message: 'That trip does not exist.' }),
    })
    const refused = await failure(bookings.list('trip-1'))
    expect(refused.code).toBe('not_found')
    expect(refused.message).toBe('That trip does not exist.')

    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    expect((await failure(bookings.list('trip-1'))).code).toBe('unavailable')
  })
})

describe('adding', () => {
  it('sends the form’s fields, and returns the booking the server made', async () => {
    serve({ 'POST /api/trips/trip-1/bookings': () => json(201, BOOKING) })

    expect(await bookings.create(NEW)).toEqual(EXPECTED)
    const call = lastCall()
    expect(call.body).toEqual({
      type: 'flight',
      title: 'JQ 610 BNE to MEL',
      provider: 'Jetstar',
      reference: 'K4RT2W',
      startsAt: '2030-06-15T12:30:00.000Z',
      endsAt: null,
      origin: 'BNE',
      destination: 'MEL',
      costCents: 21500,
      belongsTo: 'u-jonas',
      notes: 'window',
    })
    expect(call.body).not.toHaveProperty('tripId')
  })

  it('keeps null as null, so a group booking and no cost are told apart from "not sent"', async () => {
    serve({ 'POST /api/trips/trip-1/bookings': () => json(201, BOOKING) })

    await bookings.create({ ...NEW, belongsTo: null, costCents: null, startsAt: null })

    const sent = lastCall().raw ?? ''
    expect(sent).toContain('"belongsTo":null')
    expect(sent).toContain('"costCents":null')
    expect(sent).toContain('"startsAt":null')
  })

  it('shows the server’s message when it refuses', async () => {
    serve({
      'POST /api/trips/trip-1/bookings': () =>
        json(400, { code: 'invalid', message: 'It cannot end before it starts.' }),
    })

    const error = await failure(bookings.create(NEW))
    expect(error.code).toBe('invalid')
    expect(error.message).toBe('It cannot end before it starts.')
  })

  it('puts a trip id with odd characters safely in the address', async () => {
    serve({ 'POST /api/trips/a%2Fb/bookings': () => json(201, BOOKING) })

    await bookings.create({ ...NEW, tripId: 'a/b' })
  })
})

describe('changing and removing', () => {
  it('sends only the fields in the patch, and clears with null', async () => {
    serve({ 'PATCH /api/bookings/b-1': () => json(200, { ...BOOKING, title: 'New' }) })

    expect((await bookings.update('b-1', { title: 'New' })).title).toBe('New')
    expect(lastCall().body).toEqual({ title: 'New' })

    await bookings.update('b-1', { costCents: null, belongsTo: null })
    expect(lastCall().raw).toBe('{"costCents":null,"belongsTo":null}')
  })

  it('leaves out what the server fixes, even if the patch carries it', async () => {
    serve({ 'PATCH /api/bookings/b-1': () => json(200, BOOKING) })

    await bookings.update('b-1', {
      title: 'x',
      id: 'other',
      tripId: 'other',
      createdBy: 'u-mia',
    } as never)

    expect(lastCall().body).toEqual({ title: 'x' })
  })

  it('passes on a refusal for someone who may not', async () => {
    serve({
      'PATCH /api/bookings/b-1': () =>
        json(403, { code: 'forbidden', message: 'Only the person who added this can change it.' }),
      'DELETE /api/bookings/b-1': () =>
        json(403, { code: 'forbidden', message: 'Only the person who added this can delete it.' }),
    })

    expect((await failure(bookings.update('b-1', { title: 'x' }))).code).toBe('forbidden')
    expect((await failure(bookings.remove('b-1'))).message).toBe('Only the person who added this can delete it.')
  })

  it('removes with a DELETE', async () => {
    serve({ 'DELETE /api/bookings/b-1': () => new Response(null, { status: 204 }) })

    await bookings.remove('b-1')
    expect(lastCall().method).toBe('DELETE')
  })

  it('says a booking someone else already deleted is gone', async () => {
    serve({
      'DELETE /api/bookings/b-1': () =>
        json(404, { code: 'not_found', message: 'That booking has been deleted.' }),
    })

    const error = await failure(bookings.remove('b-1'))
    expect(error.code).toBe('not_found')
    expect(error.message).toBe('That booking has been deleted.')
  })
})
