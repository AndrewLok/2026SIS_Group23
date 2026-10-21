/*
 * The HTTP sign-in against a stubbed fetch, so no backend has to be running. What the
 * backend sends here is the shape its AuthFlowTests pin down on the Java side.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as auth from '@/services/http/auth'
import { read, reset } from '@/services/mock/db'
import { ApiError } from '@/types'

const PROFILE = { id: 'a1b2c3d4-0000-4000-8000-000000000001', displayName: 'Sam', email: 'sam@example.com', avatarHue: 210 }

const json = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

const fetchMock = vi.fn<typeof fetch>()

beforeEach(() => {
  reset()
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

/** The error a call rejects with, so a test can look at its code and message. */
async function failure(promise: Promise<unknown>): Promise<ApiError> {
  const error: unknown = await promise.then(
    () => null,
    (e: unknown) => e,
  )
  expect(error).toBeInstanceOf(ApiError)
  return error as ApiError
}

describe('signIn', () => {
  it('posts the credentials as JSON and returns the profile', async () => {
    fetchMock.mockResolvedValue(json(200, PROFILE))

    await expect(auth.signIn('sam@example.com', 'hunter22')).resolves.toEqual(PROFILE)

    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe('/api/auth/login')
    expect(init?.method).toBe('POST')
    expect(init?.credentials).toBe('same-origin')
    expect(init?.headers).toEqual({ 'Content-Type': 'application/json' })
    expect(JSON.parse(String(init?.body))).toEqual({ email: 'sam@example.com', password: 'hunter22' })
  })

  it('mirrors the account into the local store so the mock trip screens can find it', async () => {
    fetchMock.mockResolvedValue(json(200, PROFILE))

    await auth.signIn('sam@example.com', 'hunter22')

    expect(read().sessionUserId).toBe(PROFILE.id)
    expect(read().profiles.find((p) => p.id === PROFILE.id)).toEqual({
      id: PROFILE.id,
      display_name: 'Sam',
      email: 'sam@example.com',
      avatar_hue: 210,
    })
  })

  it('keeps the backend message and code for a wrong password, and signs nobody in', async () => {
    fetchMock.mockResolvedValue(
      json(401, { code: 'invalid_credentials', message: 'That email and password do not match.' }),
    )

    const error = await failure(auth.signIn('sam@example.com', 'wrong'))

    expect(error.code).toBe('invalid_credentials')
    expect(error.message).toBe('That email and password do not match.')
    expect(read().sessionUserId).toBeNull()
  })

  it('reports an unreachable server as unavailable', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))

    const error = await failure(auth.signIn('sam@example.com', 'hunter22'))

    expect(error.code).toBe('unavailable')
    expect(error.message).toMatch(/could not reach the server/i)
  })

  it('falls back to the status when the error has no usable body', async () => {
    fetchMock.mockResolvedValue(new Response('<html>Server error</html>', { status: 500 }))

    const error = await failure(auth.signIn('sam@example.com', 'x'))

    expect(error.code).toBe('unavailable')
    expect(error.message).toMatch(/went wrong on our side/i)
  })

  it('says the server could not be reached when a proxy reports the backend is down', async () => {
    fetchMock.mockResolvedValue(new Response('<html>Bad gateway</html>', { status: 502 }))

    const error = await failure(auth.signIn('sam@example.com', 'x'))

    expect(error.code).toBe('unavailable')
    expect(error.message).toMatch(/could not reach the server/i)
  })

  it('refuses a success response that is not a profile', async () => {
    fetchMock.mockResolvedValue(json(200, { id: 7, email: 'sam@example.com' }))

    expect((await failure(auth.signIn('sam@example.com', 'x'))).code).toBe('unavailable')
    expect(read().sessionUserId).toBeNull()
  })
})

describe('signUp', () => {
  it('sends displayName, email and password, and signs the new member in', async () => {
    fetchMock.mockResolvedValue(json(201, PROFILE))

    await expect(auth.signUp('Sam', 'sam@example.com', 'hunter22')).resolves.toEqual(PROFILE)

    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe('/api/auth/register')
    expect(JSON.parse(String(init?.body))).toEqual({
      displayName: 'Sam',
      email: 'sam@example.com',
      password: 'hunter22',
    })
    expect(read().sessionUserId).toBe(PROFILE.id)
  })

  it('surfaces a duplicate email as a conflict', async () => {
    fetchMock.mockResolvedValue(
      json(409, { code: 'conflict', message: 'There is already an account with that email.' }),
    )

    const error = await failure(auth.signUp('Sam', 'sam@example.com', 'hunter22'))

    expect(error.code).toBe('conflict')
    expect(error.message).toBe('There is already an account with that email.')
  })
})

describe('getSession', () => {
  it('returns the profile for a live session', async () => {
    fetchMock.mockResolvedValue(json(200, PROFILE))

    await expect(auth.getSession()).resolves.toEqual(PROFILE)
    expect(fetchMock.mock.calls[0]![0]).toBe('/api/auth/me')
    expect(read().sessionUserId).toBe(PROFILE.id)
  })

  it('returns null on a 401 and drops any stale local session', async () => {
    fetchMock.mockResolvedValueOnce(json(200, PROFILE))
    await auth.getSession()
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 401 }))

    await expect(auth.getSession()).resolves.toBeNull()
    expect(read().sessionUserId).toBeNull()
  })

  it('throws, rather than reporting signed out, when the server cannot be reached', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))

    expect((await failure(auth.getSession())).code).toBe('unavailable')
  })
})

describe('signOut', () => {
  it('posts to logout and clears the local session', async () => {
    fetchMock.mockResolvedValueOnce(json(200, PROFILE))
    await auth.signIn('sam@example.com', 'hunter22')
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }))

    await auth.signOut()

    expect(fetchMock.mock.calls[1]![0]).toBe('/api/auth/logout')
    expect(fetchMock.mock.calls[1]![1]?.method).toBe('POST')
    expect(read().sessionUserId).toBeNull()
  })

  it('stays signed in locally when the server could not be told', async () => {
    fetchMock.mockResolvedValueOnce(json(200, PROFILE))
    await auth.signIn('sam@example.com', 'hunter22')
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))

    expect((await failure(auth.signOut())).code).toBe('unavailable')
    expect(read().sessionUserId).toBe(PROFILE.id)
  })
})
