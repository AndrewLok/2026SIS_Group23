/*
 * The HTTP activities and votes clients against a stubbed fetch, so no backend has to be running.
 * The fixtures are the shapes the backend's IdeaFlowTests pin down on the Java side.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as ideas from '@/services/http/ideas'
import * as votes from '@/services/http/votes'
import { ApiError } from '@/types'

const IDEA = {
  id: 'i-1',
  tripId: 'trip-1',
  title: 'Kayak out to the seal colony',
  description: 'Two hours from Marengo',
  category: 'activity',
  proposedStart: '2026-11-08T05:30:00Z',
  proposedEnd: null,
  allDay: false,
  status: 'voting',
  proposedBy: 'u-priya',
  attendeeIds: ['u-priya'],
  createdAt: '2026-11-01T09:30:00.123456Z',
}
const VOTE = { ideaId: 'i-1', userId: 'u-priya', value: 1, createdAt: '2026-11-01T09:30:00.123456Z' }

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

describe('activities', () => {
  it('lists a trip’s activities as the app’s Idea type', async () => {
    serve({ 'GET /api/trips/trip-1/ideas': () => json(200, [IDEA]) })

    expect(await ideas.list('trip-1')).toEqual([IDEA])
  })

  it('copes with a trip that has none', async () => {
    serve({ 'GET /api/trips/trip-1/ideas': () => json(200, []) })

    expect(await ideas.list('trip-1')).toEqual([])
  })

  it('puts an id from the screen in the path safely', async () => {
    serve({ 'GET /api/trips/a%2Fb/ideas': () => json(200, []) })

    await ideas.list('a/b')

    expect(lastCall().url).toBe('/api/trips/a%2Fb/ideas')
  })

  it.each([
    ['a category it does not know', { ...IDEA, category: 'party' }],
    ['a status it does not know', { ...IDEA, status: 'maybe' }],
    ['no title', { ...IDEA, title: undefined }],
    ['a start that is not text', { ...IDEA, proposedStart: 5 }],
    ['an allDay that is not a boolean', { ...IDEA, allDay: 'no' }],
    ['attendees that are not ids', { ...IDEA, attendeeIds: [1, 2] }],
    ['no attendee list', { ...IDEA, attendeeIds: undefined }],
  ])('treats %s as the server misbehaving', async (_name, bad) => {
    serve({ 'GET /api/trips/trip-1/ideas': () => json(200, [bad]) })

    const error = await failure(ideas.list('trip-1'))

    expect(error.code).toBe('unavailable')
  })

  it('treats a body that is not a list as the server misbehaving', async () => {
    serve({ 'GET /api/trips/trip-1/ideas': () => json(200, { ideas: [] }) })

    expect((await failure(ideas.list('trip-1'))).code).toBe('unavailable')
  })

  it('adds one, sending only what the server reads', async () => {
    serve({ 'POST /api/trips/trip-1/ideas': () => json(201, IDEA) })

    const created = await ideas.create({
      tripId: 'trip-1',
      title: 'Kayak out to the seal colony',
      description: 'Two hours from Marengo',
      category: 'activity',
      proposedStart: '2026-11-08T05:30:00.000Z',
      proposedEnd: null,
      allDay: false,
      needsVote: true,
      attendeeIds: [],
    })

    expect(created).toEqual(IDEA)
    expect(lastCall().body).toEqual({
      title: 'Kayak out to the seal colony',
      description: 'Two hours from Marengo',
      category: 'activity',
      proposedStart: '2026-11-08T05:30:00.000Z',
      proposedEnd: null,
      allDay: false,
      needsVote: true,
      attendeeIds: [],
    })
  })

  it('shows the server’s reason when it refuses one', async () => {
    serve({
      'POST /api/trips/trip-1/ideas': () =>
        json(400, { code: 'invalid', message: 'Pick at least one person who is going.' }),
    })

    const error = await failure(
      ideas.create({
        tripId: 'trip-1',
        title: 'Lunch',
        description: '',
        category: 'food',
        proposedStart: '2026-11-08T05:30:00.000Z',
        proposedEnd: null,
        allDay: false,
        needsVote: false,
        attendeeIds: [],
      }),
    )

    expect(error.code).toBe('invalid')
    expect(error.message).toBe('Pick at least one person who is going.')
  })

  it('changes only what is in the patch, and clears a time with null', async () => {
    serve({ 'PATCH /api/ideas/i-1': () => json(200, IDEA) })

    await ideas.update('i-1', { title: 'Sea kayak', proposedStart: null })

    expect(lastCall().raw).toBe('{"title":"Sea kayak","proposedStart":null}')
  })

  it('never sends the status, the proposer or the ids in a patch', async () => {
    serve({ 'PATCH /api/ideas/i-1': () => json(200, IDEA) })

    await ideas.update('i-1', {
      title: 'Sea kayak',
      status: 'agreed',
      proposedBy: 'u-mia',
      id: 'other',
      tripId: 'other',
      createdAt: '2020-01-01T00:00:00Z',
    })

    expect(lastCall().body).toEqual({ title: 'Sea kayak' })
  })

  it('rules one out and puts it back', async () => {
    serve({ 'PUT /api/ideas/i-1/status': () => json(200, { ...IDEA, status: 'rejected' }) })

    const ruledOut = await ideas.setStatus('i-1', 'rejected')

    expect(ruledOut.status).toBe('rejected')
    expect(lastCall().body).toEqual({ status: 'rejected' })
  })

  it('says in and out', async () => {
    serve({
      'PUT /api/ideas/i-1/attendance': () =>
        json(200, { ...IDEA, status: 'agreed', attendeeIds: ['u-priya', 'u-mia'] }),
    })

    const joined = await ideas.setAttending('i-1', true)

    expect(joined.attendeeIds).toEqual(['u-priya', 'u-mia'])
    expect(lastCall().body).toEqual({ attending: true })
  })

  it('deletes one', async () => {
    serve({ 'DELETE /api/ideas/i-1': () => new Response(null, { status: 204 }) })

    await expect(ideas.remove('i-1')).resolves.toBeUndefined()
    expect(lastCall().method).toBe('DELETE')
  })

  it.each([
    [403, { code: 'forbidden', message: 'Only the person who added this, or the trip owner, can delete it.' }, 'forbidden'],
    [404, { code: 'not_found', message: 'That activity has been deleted.' }, 'not_found'],
  ])('passes a %i from the server on as it was worded', async (status, body, code) => {
    serve({ 'DELETE /api/ideas/i-1': () => json(status, body) })

    const error = await failure(ideas.remove('i-1'))

    expect(error.code).toBe(code)
    expect(error.message).toBe(body.message)
  })

  it('says so when the server cannot be reached', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))

    const error = await failure(ideas.list('trip-1'))

    expect(error.code).toBe('unavailable')
  })
})

describe('votes', () => {
  it('lists every vote on a trip', async () => {
    serve({ 'GET /api/trips/trip-1/votes': () => json(200, [VOTE, { ...VOTE, userId: 'u-mia', value: -1 }]) })

    const found = await votes.listForTrip('trip-1')

    expect(found).toEqual([VOTE, { ...VOTE, userId: 'u-mia', value: -1 }])
  })

  it.each([
    ['a value of 0', { ...VOTE, value: 0 }],
    ['a value of 2', { ...VOTE, value: 2 }],
    ['a value that is text', { ...VOTE, value: '1' }],
    ['no voter', { ...VOTE, userId: undefined }],
  ])('treats %s as the server misbehaving', async (_name, bad) => {
    serve({ 'GET /api/trips/trip-1/votes': () => json(200, [bad]) })

    expect((await failure(votes.listForTrip('trip-1'))).code).toBe('unavailable')
  })

  it('casts a vote for and against', async () => {
    serve({ 'PUT /api/ideas/i-1/vote': () => new Response(null, { status: 204 }) })

    await votes.cast('i-1', 1)
    expect(lastCall().body).toEqual({ value: 1 })

    await votes.cast('i-1', -1)
    expect(lastCall().body).toEqual({ value: -1 })
  })

  it('withdraws a vote', async () => {
    serve({ 'DELETE /api/ideas/i-1/vote': () => new Response(null, { status: 204 }) })

    await expect(votes.clear('i-1')).resolves.toBeUndefined()
    expect(lastCall().method).toBe('DELETE')
  })

  it('shows why a vote was refused', async () => {
    serve({
      'PUT /api/ideas/i-1/vote': () =>
        json(400, { code: 'invalid', message: 'This one was added without a vote.' }),
    })

    const error = await failure(votes.cast('i-1', 1))

    expect(error.code).toBe('invalid')
    expect(error.message).toBe('This one was added without a vote.')
  })

  it('treats an activity deleted under you as not found', async () => {
    serve({
      'PUT /api/ideas/i-1/vote': () =>
        json(404, { code: 'not_found', message: 'That activity has been deleted.' }),
    })

    expect((await failure(votes.cast('i-1', 1))).code).toBe('not_found')
  })
})
