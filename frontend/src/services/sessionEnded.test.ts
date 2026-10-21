import { afterEach, describe, expect, it, vi } from 'vitest'
import { isSessionEnded, onSessionEnded, reportIfSessionEnded } from '@/services/sessionEnded'
import { ApiError } from '@/types'

const stops: Array<() => void> = []
function listen(): ReturnType<typeof vi.fn> {
  const listener = vi.fn()
  stops.push(onSessionEnded(listener))
  return listener
}

/** Listeners are told on the next tick; wait for it. */
const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 5))

afterEach(() => {
  while (stops.length > 0) stops.pop()!()
})

describe('isSessionEnded', () => {
  it('is true only for the unauthenticated error', () => {
    expect(isSessionEnded(new ApiError('unauthenticated', 'Sign in to do that.'))).toBe(true)
  })

  it.each(['forbidden', 'not_found', 'invalid', 'conflict', 'invalid_credentials', 'unavailable'] as const)(
    'is false for %s, which is the server answering, not forgetting who you are',
    (code) => {
      expect(isSessionEnded(new ApiError(code, 'x'))).toBe(false)
    },
  )

  it('is false for things that are not ApiErrors', () => {
    expect(isSessionEnded(new Error('boom'))).toBe(false)
    expect(isSessionEnded(null)).toBe(false)
    expect(isSessionEnded({ code: 'unauthenticated' })).toBe(false)
  })
})

describe('reportIfSessionEnded', () => {
  it('tells every listener, after the current tick', async () => {
    const first = listen()
    const second = listen()

    reportIfSessionEnded(new ApiError('unauthenticated', 'Sign in to do that.'))
    expect(first).not.toHaveBeenCalled() // not inside the query client's own error handling

    await tick()
    expect(first).toHaveBeenCalledTimes(1)
    expect(second).toHaveBeenCalledTimes(1)
  })

  it('says nothing for any other error', async () => {
    const listener = listen()

    reportIfSessionEnded(new ApiError('forbidden', 'You are not allowed to do that.'))
    reportIfSessionEnded(new ApiError('invalid_credentials', 'That email and password do not match.'))
    reportIfSessionEnded(new Error('boom'))
    await tick()

    expect(listener).not.toHaveBeenCalled()
  })

  it('stops telling a listener that has stopped listening', async () => {
    const listener = vi.fn()
    const stop = onSessionEnded(listener)
    stop()

    reportIfSessionEnded(new ApiError('unauthenticated', 'Sign in to do that.'))
    await tick()

    expect(listener).not.toHaveBeenCalled()
  })
})
