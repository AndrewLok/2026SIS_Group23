/*
 * The calendar client against a stubbed fetch. The fixtures are the shapes the backend's
 * CalendarFlowTests pin down on the Java side.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as calendar from '@/services/http/calendar'
import { ApiError } from '@/types'

const PATH = '/api/calendar/feeds/' + 'a'.repeat(43) + '.ics'

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

describe('the subscription link', () => {
  it('reads the path the server gives', async () => {
    serve({ 'GET /api/trips/t-1/calendar/feed': () => json(200, { path: PATH }) })

    expect(await calendar.feedPath('t-1')).toBe(PATH)
  })

  it('makes a new one with a POST', async () => {
    serve({ 'POST /api/trips/t-1/calendar/feed': () => json(200, { path: PATH }) })

    expect(await calendar.renewFeed('t-1')).toBe(PATH)
  })

  it('puts a trip id with odd characters safely in the address', async () => {
    serve({ 'GET /api/trips/a%2Fb/calendar/feed': () => json(200, { path: PATH }) })

    expect(await calendar.feedPath('a/b')).toBe(PATH)
  })

  it('treats a reply with no usable path as the server misbehaving', async () => {
    for (const body of [{}, { path: 5 }, { path: 'api/no-leading-slash' }, null, 'text']) {
      serve({ 'GET /api/trips/t-1/calendar/feed': () => json(200, body) })
      expect((await failure(calendar.feedPath('t-1'))).code).toBe('unavailable')
    }
  })

  it('passes on the server’s refusal', async () => {
    serve({
      'GET /api/trips/t-1/calendar/feed': () =>
        json(404, { code: 'not_found', message: 'That trip does not exist.' }),
    })

    const error = await failure(calendar.feedPath('t-1'))
    expect(error.code).toBe('not_found')
    expect(error.message).toBe('That trip does not exist.')
  })

  it('says so when the server cannot be reached', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))

    expect((await failure(calendar.renewFeed('t-1'))).code).toBe('unavailable')
  })
})

describe('the download', () => {
  const file = (disposition: string | null): Response =>
    new Response('BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n', {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar;charset=UTF-8',
        ...(disposition ? { 'Content-Disposition': disposition } : {}),
      },
    })

  it('returns the file with the name the server suggested', async () => {
    serve({
      'GET /api/trips/t-1/calendar.ics': () =>
        file('attachment; filename="voyager-great-ocean-road.ics"'),
    })

    const result = await calendar.download('t-1')

    expect(result.name).toBe('voyager-great-ocean-road.ics')
    expect(await result.blob.text()).toBe('BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n')
  })

  it('falls back to a fixed name when there is none, or one that is not plain', async () => {
    for (const disposition of [null, 'attachment', 'attachment; filename="../../evil.ics"', 'attachment; filename="a b.ics"']) {
      serve({ 'GET /api/trips/t-1/calendar.ics': () => file(disposition) })
      expect((await calendar.download('t-1')).name).toBe('voyager-trip.ics')
    }
  })

  it('reads the name out of a header on its own', () => {
    expect(calendar.fileNameFrom('attachment; filename="x-1.ics"')).toBe('x-1.ics')
    expect(calendar.fileNameFrom(null)).toBe('voyager-trip.ics')
  })

  it('passes on a refusal, which comes back as JSON, not a file', async () => {
    serve({
      'GET /api/trips/t-1/calendar.ics': () =>
        json(404, { code: 'not_found', message: 'That trip does not exist.' }),
    })

    expect((await failure(calendar.download('t-1'))).code).toBe('not_found')
  })

  it('treats a signed-out reply as asking to sign in', async () => {
    serve({ 'GET /api/trips/t-1/calendar.ics': () => new Response(null, { status: 401 }) })

    expect((await failure(calendar.download('t-1'))).code).toBe('unauthenticated')
  })
})
