/*
 * The HTTP chat client against a stubbed fetch, so no backend has to be running. The fixtures are
 * the shapes the backend's ChatFlowTests pin down on the Java side.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as chat from '@/services/http/chat'
import { ApiError } from '@/types'

const CHANNEL = { id: 'ch-1', tripId: 'trip-1', name: 'general' }
const MESSAGE = {
  id: 'm-1',
  channelId: 'ch-1',
  authorId: 'u-priya',
  body: 'Petrol stop at Colac?',
  createdAt: '2026-11-08T09:30:00.123456Z',
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
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('channels and messages', () => {
  it('lists a trip’s channels', async () => {
    serve({ 'GET /api/trips/trip-1/channels': () => json(200, [CHANNEL]) })

    expect(await chat.listChannels('trip-1')).toEqual([CHANNEL])
  })

  it('lists messages in the order the backend sends them, keeping only what the app knows', async () => {
    const second = { ...MESSAGE, id: 'm-2', body: 'Yes please', authorId: 'u-jonas', extra: 'ignored' }
    serve({ 'GET /api/channels/ch-1/messages': () => json(200, [MESSAGE, second]) })

    const messages = await chat.listMessages('ch-1')

    expect(messages.map((m) => m.id)).toEqual(['m-1', 'm-2'])
    expect(messages[1]).toEqual({
      id: 'm-2',
      channelId: 'ch-1',
      authorId: 'u-jonas',
      body: 'Yes please',
      createdAt: '2026-11-08T09:30:00.123456Z',
    })
  })

  it('sends a message as JSON and returns what was saved', async () => {
    serve({ 'POST /api/channels/ch-1/messages': () => json(201, { ...MESSAGE, body: 'hello' }) })

    const saved = await chat.send('ch-1', '  hello  ')

    expect(saved.body).toBe('hello')
    // Trimming is the backend's job; the client sends what it was given.
    expect(lastCall().body).toEqual({ body: '  hello  ' })
  })

  it('puts ids into the path safely', async () => {
    serve({ 'GET /api/channels/a%2Fb/messages': () => json(200, []) })

    expect(await chat.listMessages('a/b')).toEqual([])
  })
})

describe('what has been read', () => {
  it('reads the unread count and where the divider goes', async () => {
    serve({ 'GET /api/channels/ch-1/read-state': () => json(200, { unreadCount: 2, firstUnreadId: 'm-7' }) })

    expect(await chat.readState('ch-1')).toEqual({ unreadCount: 2, firstUnreadId: 'm-7' })
  })

  it('accepts "nothing unread", where the divider id is null', async () => {
    serve({ 'GET /api/channels/ch-1/read-state': () => json(200, { unreadCount: 0, firstUnreadId: null }) })

    expect(await chat.readState('ch-1')).toEqual({ unreadCount: 0, firstUnreadId: null })
  })

  it('marks a channel read with a POST and no body', async () => {
    serve({ 'POST /api/channels/ch-1/read': () => new Response(null, { status: 204 }) })

    await expect(chat.markRead('ch-1')).resolves.toBeUndefined()
    expect(lastCall().init?.method).toBe('POST')
    expect(lastCall().body).toBeUndefined()
  })
})

describe('when something goes wrong', () => {
  it('keeps the backend message and code for a refused message', async () => {
    serve({
      'POST /api/channels/ch-1/messages': () =>
        json(400, { code: 'invalid', message: 'Type something first.' }),
    })

    const error = await failure(chat.send('ch-1', '   '))

    expect(error.code).toBe('invalid')
    expect(error.message).toBe('Type something first.')
  })

  it('reports a chat you are not allowed into as not found', async () => {
    serve({
      'GET /api/channels/ch-1/messages': () =>
        json(404, { code: 'not_found', message: 'That chat does not exist.' }),
    })

    const error = await failure(chat.listMessages('ch-1'))

    expect(error.code).toBe('not_found')
  })

  it('refuses responses that are not what the backend promised', async () => {
    serve({
      'GET /api/trips/trip-1/channels': () => json(200, { channels: [] }),
      'GET /api/channels/ch-1/messages': () => json(200, [{ id: 'm-1', body: 'no author' }]),
      'GET /api/channels/ch-1/read-state': () => json(200, { unreadCount: '2', firstUnreadId: null }),
      'POST /api/channels/ch-1/messages': () => json(201, {}),
    })

    expect((await failure(chat.listChannels('trip-1'))).code).toBe('unavailable')
    expect((await failure(chat.listMessages('ch-1'))).code).toBe('unavailable')
    expect((await failure(chat.readState('ch-1'))).code).toBe('unavailable')
    expect((await failure(chat.send('ch-1', 'hi'))).code).toBe('unavailable')
  })

  it('reports an unreachable server as unavailable', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))

    expect((await failure(chat.listMessages('ch-1'))).code).toBe('unavailable')
  })
})
