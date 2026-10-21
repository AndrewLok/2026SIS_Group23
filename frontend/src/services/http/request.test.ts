/*
 * How a failed response becomes an ApiError. The distinction that matters most is 401 against 403:
 * "the server does not know who you are" ends the session and sends the person to sign in, while
 * "you are not allowed" is just a message on the screen.
 */

import { describe, expect, it } from 'vitest'
import { errorFrom } from '@/services/http/request'

const json = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

describe('errorFrom', () => {
  it('reads an empty 401 (what the security filter sends) as unauthenticated', async () => {
    const error = await errorFrom(new Response(null, { status: 401 }))

    expect(error.code).toBe('unauthenticated')
    expect(error.message).toBe('Sign in to do that.')
  })

  it('reads a 401 with the backend\'s own unauthenticated body the same way, keeping its words', async () => {
    const error = await errorFrom(json(401, { code: 'unauthenticated', message: 'Sign in to do that.' }))

    expect(error.code).toBe('unauthenticated')
  })

  it('keeps a wrong password as invalid_credentials even though it is also a 401', async () => {
    const error = await errorFrom(json(401, { code: 'invalid_credentials', message: 'That email and password do not match.' }))

    expect(error.code).toBe('invalid_credentials')
    expect(error.message).toBe('That email and password do not match.')
  })

  it('reads a 403 as forbidden, not as the session ending', async () => {
    const empty = await errorFrom(new Response(null, { status: 403 }))
    const worded = await errorFrom(json(403, { code: 'forbidden', message: 'Only the trip owner can make a new code.' }))

    expect(empty.code).toBe('forbidden')
    expect(worded.code).toBe('forbidden')
    expect(worded.message).toBe('Only the trip owner can make a new code.')
  })

  it('falls back to the status when the body has a code this app does not know', async () => {
    const error = await errorFrom(json(404, { code: 'teapot', message: 'Short and stout.' }))

    expect(error.code).toBe('not_found')
  })

  it.each([
    [400, 'invalid'],
    [404, 'not_found'],
    [409, 'conflict'],
    [502, 'unavailable'],
    [503, 'unavailable'],
    [500, 'unavailable'],
  ] as const)('maps an empty %i to %s', async (status, code) => {
    expect((await errorFrom(new Response(null, { status }))).code).toBe(code)
  })
})
