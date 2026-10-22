/*
 * The HTTP fuel client against a stubbed fetch, so no backend has to be running.
 * The fixtures are the shapes the backend's FuelFlowTests pin down on the Java side.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as fuel from '@/services/http/fuel'
import { ApiError } from '@/types'

const LEG = {
  id: 'l-1',
  tripId: 'trip-1',
  label: 'Lorne to Apollo Bay',
  distanceKm: 100,
  efficiencyL100km: 8,
  pricePerLitreCents: 200,
  driverId: 'u-mia',
  riderIds: ['u-jonas', 'u-mia'],
  createdBy: 'u-jonas',
  createdAt: '2026-11-01T09:30:00.123456Z',
}

const NEW = {
  tripId: 'trip-1',
  label: 'Lorne to Apollo Bay',
  distanceKm: 100,
  efficiencyL100km: 8,
  pricePerLitreCents: 200,
  driverId: 'u-mia',
  riderIds: ['u-jonas', 'u-mia'],
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
  it('reads a trip’s legs as the app’s FuelLeg type, in the order sent', async () => {
    const second = { ...LEG, id: 'l-2', label: 'Back again' }
    serve({ 'GET /api/trips/trip-1/fuel-legs': () => json(200, [LEG, second]) })

    expect(await fuel.list('trip-1')).toEqual([LEG, second])
  })

  it('copes with a trip that has none, and with a leg nobody is recorded as adding', async () => {
    serve({ 'GET /api/trips/trip-1/fuel-legs': () => json(200, []) })
    expect(await fuel.list('trip-1')).toEqual([])

    serve({ 'GET /api/trips/trip-1/fuel-legs': () => json(200, [{ ...LEG, createdBy: null }]) })
    expect(await fuel.list('trip-1')).toEqual([{ ...LEG, createdBy: null }])
  })

  it('keeps decimal figures as they were sent', async () => {
    serve({
      'GET /api/trips/trip-1/fuel-legs': () =>
        json(200, [{ ...LEG, distanceKm: 33.3, efficiencyL100km: 6.1 }]),
    })

    const [leg] = await fuel.list('trip-1')
    expect(leg?.distanceKm).toBe(33.3)
    expect(leg?.efficiencyL100km).toBe(6.1)
  })

  it('treats a leg of the wrong shape as the server misbehaving', async () => {
    const broken = [
      { ...LEG, id: 5 },
      { ...LEG, distanceKm: '100' },
      { ...LEG, distanceKm: undefined },
      { ...LEG, efficiencyL100km: null },
      { ...LEG, pricePerLitreCents: '200' },
      { ...LEG, driverId: null },
      { ...LEG, riderIds: 'u-jonas' },
      { ...LEG, riderIds: ['u-jonas', 5] },
      { ...LEG, riderIds: undefined },
      { ...LEG, createdBy: undefined },
      { ...LEG, createdBy: 5 },
      { ...LEG, createdAt: undefined },
      'text',
      null,
    ]
    for (const item of broken) {
      serve({ 'GET /api/trips/trip-1/fuel-legs': () => json(200, [item]) })
      expect((await failure(fuel.list('trip-1'))).code).toBe('unavailable')
    }
    serve({ 'GET /api/trips/trip-1/fuel-legs': () => json(200, { not: 'a list' }) })
    expect((await failure(fuel.list('trip-1'))).code).toBe('unavailable')
  })

  it('passes on a refusal, and says so when the server cannot be reached', async () => {
    serve({
      'GET /api/trips/trip-1/fuel-legs': () =>
        json(404, { code: 'not_found', message: 'That trip does not exist.' }),
    })
    const refused = await failure(fuel.list('trip-1'))
    expect(refused.code).toBe('not_found')
    expect(refused.message).toBe('That trip does not exist.')

    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    expect((await failure(fuel.list('trip-1'))).code).toBe('unavailable')
  })
})

describe('adding', () => {
  it('sends the form’s fields, and returns the leg the server made', async () => {
    serve({ 'POST /api/trips/trip-1/fuel-legs': () => json(201, LEG) })

    expect(await fuel.create(NEW)).toEqual(LEG)
    const call = lastCall()
    expect(call.method).toBe('POST')
    expect(call.body).toEqual({
      label: 'Lorne to Apollo Bay',
      distanceKm: 100,
      efficiencyL100km: 8,
      pricePerLitreCents: 200,
      driverId: 'u-mia',
      riderIds: ['u-jonas', 'u-mia'],
    })
    expect(call.body).not.toHaveProperty('tripId')
  })

  it('shows the server’s message when it refuses', async () => {
    serve({
      'POST /api/trips/trip-1/fuel-legs': () =>
        json(400, { code: 'invalid', message: 'The driver has to be on the trip.' }),
    })

    const error = await failure(fuel.create(NEW))
    expect(error.code).toBe('invalid')
    expect(error.message).toBe('The driver has to be on the trip.')
  })

  it('treats an answer that is not a leg as the server misbehaving', async () => {
    serve({ 'POST /api/trips/trip-1/fuel-legs': () => json(201, { ...LEG, riderIds: null }) })
    expect((await failure(fuel.create(NEW))).code).toBe('unavailable')
  })

  it('puts a trip id with odd characters safely in the address', async () => {
    serve({ 'POST /api/trips/a%2Fb/fuel-legs': () => json(201, LEG) })

    await fuel.create({ ...NEW, tripId: 'a/b' })
  })
})

describe('changing', () => {
  it('sends only what changed, and never who added it or which trip it is on', async () => {
    serve({ 'PATCH /api/fuel-legs/l-1': () => json(200, { ...LEG, label: 'Renamed' }) })

    const leg = await fuel.update('l-1', {
      label: 'Renamed',
      tripId: 'other',
      createdBy: 'u-mia',
      createdAt: '2000-01-01T00:00:00Z',
      id: 'x',
    })

    expect(leg.label).toBe('Renamed')
    const call = lastCall()
    expect(call.method).toBe('PATCH')
    expect(call.body).toEqual({ label: 'Renamed' })
  })

  it('sends the riders and the driver when those change', async () => {
    serve({ 'PATCH /api/fuel-legs/l-1': () => json(200, LEG) })

    await fuel.update('l-1', { driverId: 'u-jonas', riderIds: ['u-jonas'] })

    expect(lastCall().body).toEqual({ driverId: 'u-jonas', riderIds: ['u-jonas'] })
  })

  it('sends every figure that changed', async () => {
    serve({ 'PATCH /api/fuel-legs/l-1': () => json(200, LEG) })

    await fuel.update('l-1', { distanceKm: 150.5, efficiencyL100km: 7.5, pricePerLitreCents: 210 })

    expect(lastCall().body).toEqual({
      distanceKm: 150.5,
      efficiencyL100km: 7.5,
      pricePerLitreCents: 210,
    })
  })

  it('shows the server’s refusal', async () => {
    serve({
      'PATCH /api/fuel-legs/l-1': () =>
        json(403, {
          code: 'forbidden',
          message: 'Only the person who added this, the driver, or the trip owner, can change it.',
        }),
    })

    const error = await failure(fuel.update('l-1', { label: 'x' }))
    expect(error.code).toBe('forbidden')
  })
})

describe('deleting', () => {
  it('sends the delete and expects nothing back', async () => {
    serve({ 'DELETE /api/fuel-legs/l-1': () => new Response(null, { status: 204 }) })

    await expect(fuel.remove('l-1')).resolves.toBeUndefined()
    expect(lastCall().method).toBe('DELETE')
  })

  it('says so when the leg is already gone', async () => {
    serve({
      'DELETE /api/fuel-legs/l-1': () =>
        json(404, { code: 'not_found', message: 'That leg has been deleted.' }),
    })

    const error = await failure(fuel.remove('l-1'))
    expect(error.code).toBe('not_found')
    expect(error.message).toBe('That leg has been deleted.')
  })

  it('puts a leg id with odd characters safely in the address', async () => {
    serve({ 'DELETE /api/fuel-legs/a%2Fb': () => new Response(null, { status: 204 }) })

    await fuel.remove('a/b')
  })
})
