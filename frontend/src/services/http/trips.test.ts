/*
 * The HTTP trips client against a stubbed fetch, so no backend has to be running. The fixtures are
 * the shapes the backend's TripFlowTests pin down on the Java side.
 *
 * The last block checks the bridge: that mock services (ideas, votes) still work on a trip and on
 * people that came from the backend, which is what keeps the unfinished screens usable.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as trips from '@/services/http/trips'
import * as ideas from '@/services/mock/ideas'
import * as votes from '@/services/mock/votes'
import { adoptSession } from '@/services/mock/bridge'
import { read, reset } from '@/services/mock/db'
import { ApiError } from '@/types'

const TRIP = {
  id: 'trip-real',
  name: 'Great Ocean Road',
  destination: 'Victoria',
  startDate: '2026-11-08T00:00:00Z',
  endDate: null,
  inviteCode: 'K7M2QX',
  createdBy: 'u-priya',
  currency: 'AUD',
  coverHue: 120,
  allowanceCents: 25000,
  defaultEfficiency: 8.0,
  defaultPricePerLitreCents: 195,
  privateDebts: true,
  budgetCapCents: null, // the backend sends this; the app has no use for it yet
}

const MEMBERS = [
  { tripId: 'trip-real', userId: 'u-priya', role: 'owner', joinedAt: '2026-10-01T00:00:00Z', profile: { id: 'u-priya', displayName: 'Priya Nair', avatarHue: 40 } },
  { tripId: 'trip-real', userId: 'u-jonas', role: 'member', joinedAt: '2026-10-02T00:00:00Z', profile: { id: 'u-jonas', displayName: 'Jonas Weber', avatarHue: 200 } },
  { tripId: 'trip-real', userId: 'u-mia', role: 'member', joinedAt: '2026-10-03T00:00:00Z', profile: { id: 'u-mia', displayName: 'Mia Chen', avatarHue: 300 } },
]

const json = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

const fetchMock = vi.fn<typeof fetch>()

/** Answer each "METHOD /path" with a fresh Response; anything unlisted fails the test loudly. */
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
  return { url: String(url), init, body: init?.body ? JSON.parse(String(init.body)) : undefined }
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
  reset()
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('trips', () => {
  it('lists the trips and keeps only the fields the app knows', async () => {
    serve({ 'GET /api/trips': () => json(200, [TRIP]) })

    const result = await trips.list()

    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      id: 'trip-real',
      name: 'Great Ocean Road',
      destination: 'Victoria',
      startDate: '2026-11-08T00:00:00Z',
      endDate: null,
      inviteCode: 'K7M2QX',
      createdBy: 'u-priya',
      currency: 'AUD',
      coverHue: 120,
      allowanceCents: 25000,
      defaultEfficiency: 8,
      defaultPricePerLitreCents: 195,
      privateDebts: true,
    })
  })

  it('creates a trip by sending only the four things the form has', async () => {
    serve({ 'POST /api/trips': () => json(201, TRIP) })

    const created = await trips.create({
      name: 'Great Ocean Road',
      destination: 'Victoria',
      startDate: '2026-11-08T00:00:00.000Z',
      endDate: null,
    })

    expect(created.id).toBe('trip-real')
    expect(lastCall().body).toEqual({
      name: 'Great Ocean Road',
      destination: 'Victoria',
      startDate: '2026-11-08T00:00:00.000Z',
      endDate: null,
    })
  })

  it('gets one trip', async () => {
    serve({ 'GET /api/trips/trip-real': () => json(200, TRIP) })

    expect((await trips.get('trip-real')).inviteCode).toBe('K7M2QX')
  })

  it('patches only the fields the backend lets a patch change, and keeps null to clear a date', async () => {
    serve({ 'PATCH /api/trips/trip-real': () => json(200, { ...TRIP, privateDebts: false }) })

    const updated = await trips.update('trip-real', {
      privateDebts: false,
      endDate: null,
      id: 'sneaky',
      inviteCode: 'AAAAAA',
      createdBy: 'someone-else',
    })

    expect(updated.privateDebts).toBe(false)
    expect(lastCall().body).toEqual({ privateDebts: false, endDate: null })
  })

  it('looks at a trip by code without needing an email for anyone', async () => {
    serve({
      'GET /api/trips/preview/K7M2QX': () =>
        json(200, {
          trip: { id: 'trip-real', name: 'Great Ocean Road', destination: 'Victoria', startDate: null, endDate: null },
          members: [{ id: 'u-priya', displayName: 'Priya Nair', avatarHue: 40 }],
        }),
    })

    const preview = await trips.previewByCode('  K7M2QX ')

    expect(preview.trip).toEqual({ id: 'trip-real', name: 'Great Ocean Road', destination: 'Victoria', startDate: null, endDate: null })
    expect(preview.members).toEqual([{ id: 'u-priya', displayName: 'Priya Nair', email: '', avatarHue: 40 }])
  })

  it('joins by code and makes a new code', async () => {
    serve({
      'POST /api/trips/join/K7M2QX': () => json(200, TRIP),
      'POST /api/trips/trip-real/regenerate-code': () => json(200, { ...TRIP, inviteCode: 'NEWC0D'.replace('0', '2') }),
    })

    expect((await trips.joinByCode('K7M2QX')).id).toBe('trip-real')
    expect((await trips.regenerateCode('trip-real')).inviteCode).toBe('NEWC2D')
  })

  it('keeps the backend message and code when something is refused', async () => {
    serve({
      'GET /api/trips/preview/ZZZZZZ': () =>
        json(404, { code: 'not_found', message: 'That invite code does not match a trip.' }),
      'POST /api/trips/trip-real/regenerate-code': () =>
        json(403, { code: 'forbidden', message: 'Only the trip owner can make a new code.' }),
    })

    const missing = await failure(trips.previewByCode('ZZZZZZ'))
    expect(missing.code).toBe('not_found')
    expect(missing.message).toBe('That invite code does not match a trip.')

    const forbidden = await failure(trips.regenerateCode('trip-real'))
    expect(forbidden.code).toBe('forbidden')
    expect(forbidden.message).toBe('Only the trip owner can make a new code.')
  })

  it('refuses a trip that is missing fields instead of passing undefined into the app', async () => {
    serve({ 'GET /api/trips/trip-real': () => json(200, { id: 'trip-real', name: 'No settings' }) })

    expect((await failure(trips.get('trip-real'))).code).toBe('unavailable')
  })

  it('refuses a list that is not a list', async () => {
    serve({ 'GET /api/trips': () => json(200, { trips: [] }) })

    expect((await failure(trips.list())).code).toBe('unavailable')
  })
})

describe('members', () => {
  it('lists members with their profiles and no email for other people', async () => {
    serve({ 'GET /api/trips/trip-real/members': () => json(200, MEMBERS) })

    const members = await trips.listMembers('trip-real')

    expect(members).toHaveLength(3)
    expect(members[0]).toEqual({
      tripId: 'trip-real',
      userId: 'u-priya',
      role: 'owner',
      joinedAt: '2026-10-01T00:00:00Z',
      profile: { id: 'u-priya', displayName: 'Priya Nair', email: '', avatarHue: 40 },
    })
    expect(members[1]!.role).toBe('member')
  })

  it('refuses a role it does not know', async () => {
    serve({ 'GET /api/trips/trip-real/members': () => json(200, [{ ...MEMBERS[0], role: 'admin' }]) })

    expect((await failure(trips.listMembers('trip-real'))).code).toBe('unavailable')
  })

  it('removes a member, or leaves, with a DELETE', async () => {
    serve({ 'DELETE /api/trips/trip-real/members/u-jonas': () => new Response(null, { status: 204 }) })

    await expect(trips.removeMember('trip-real', 'u-jonas')).resolves.toBeUndefined()
    expect(lastCall().init?.method).toBe('DELETE')
  })

  it('surfaces the last-owner rule as it was worded', async () => {
    serve({
      'DELETE /api/trips/trip-real/members/u-priya': () =>
        json(403, { code: 'forbidden', message: 'A trip needs an owner. Hand it over before you leave.' }),
    })

    const error = await failure(trips.removeMember('trip-real', 'u-priya'))

    expect(error.code).toBe('forbidden')
    expect(error.message).toBe('A trip needs an owner. Hand it over before you leave.')
  })

  it('changes a role with a PATCH', async () => {
    serve({ 'PATCH /api/trips/trip-real/members/u-jonas': () => new Response(null, { status: 204 }) })

    await trips.updateRole('trip-real', 'u-jonas', 'owner')

    expect(lastCall().body).toEqual({ role: 'owner' })
  })
})

describe('the bridge into the mock store', () => {
  it('mirrors a trip once, and leaves chat to the real backend', async () => {
    serve({ 'GET /api/trips': () => json(200, [TRIP]) })

    await trips.list()
    await trips.list()

    expect(read().trips.filter((t) => t.id === 'trip-real')).toHaveLength(1)
    expect(read().trips.find((t) => t.id === 'trip-real')?.invite_code).toBe('K7M2QX')
    // Chat is real now, so no mock channel is invented for a real trip.
    expect(read().channels.filter((c) => c.trip_id === 'trip-real')).toHaveLength(0)
  })

  it('mirrors members and profiles, keeps the signed-in email, and drops people who left', async () => {
    adoptSession({ id: 'u-priya', displayName: 'Priya Nair', email: 'priya@example.com', avatarHue: 40 })
    serve({ 'GET /api/trips/trip-real/members': () => json(200, MEMBERS) })
    await trips.listMembers('trip-real')

    const mirrored = () => read().tripMembers.filter((m) => m.trip_id === 'trip-real').map((m) => m.user_id)
    expect(mirrored()).toEqual(['u-priya', 'u-jonas', 'u-mia'])
    expect(read().profiles.find((p) => p.id === 'u-priya')?.email).toBe('priya@example.com')
    expect(read().profiles.find((p) => p.id === 'u-jonas')?.display_name).toBe('Jonas Weber')

    serve({ 'GET /api/trips/trip-real/members': () => json(200, [MEMBERS[0], MEMBERS[2]]) })
    await trips.listMembers('trip-real')
    expect(mirrored()).toEqual(['u-priya', 'u-mia'])
  })

  it('lets the mock ideas and voting run on a real trip: proposing, then a second vote agrees it', async () => {
    adoptSession({ id: 'u-priya', displayName: 'Priya Nair', email: 'priya@example.com', avatarHue: 40 })
    serve({
      'GET /api/trips': () => json(200, [TRIP]),
      'GET /api/trips/trip-real/members': () => json(200, MEMBERS),
    })
    await trips.list()
    await trips.listMembers('trip-real')

    const idea = await ideas.create({
      tripId: 'trip-real',
      title: 'Kayaking',
      description: '',
      category: 'activity',
      proposedStart: null,
      proposedEnd: null,
      allDay: false,
      needsVote: true,
      attendeeIds: [],
    })
    // Three members need two agrees. The proposer's own vote is one.
    expect(idea.status).toBe('voting')

    adoptSession({ id: 'u-jonas', displayName: 'Jonas Weber', email: 'jonas@example.com', avatarHue: 200 })
    await votes.cast(idea.id, 1)

    expect(read().ideas.find((i) => i.id === idea.id)?.status).toBe('agreed')
  })
})
