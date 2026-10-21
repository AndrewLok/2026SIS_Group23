import { afterEach, describe, expect, it, vi } from 'vitest'
import { MutationObserver } from '@tanstack/react-query'
import { createQueryClient, shouldRetry } from '@/services/queryClient'
import { onSessionEnded } from '@/services/sessionEnded'
import { ApiError } from '@/types'

const stops: Array<() => void> = []
const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 5))

afterEach(() => {
  while (stops.length > 0) stops.pop()!()
})

describe('shouldRetry', () => {
  it('retries once when the server or the network hiccuped', () => {
    const down = new ApiError('unavailable', 'Could not reach the server.')

    expect(shouldRetry(0, down)).toBe(true)
    expect(shouldRetry(1, down)).toBe(false)
  })

  it('retries an error that is not an ApiError once too, since it may be a dropped connection', () => {
    expect(shouldRetry(0, new TypeError('Failed to fetch'))).toBe(true)
    expect(shouldRetry(1, new TypeError('Failed to fetch'))).toBe(false)
  })

  it.each(['not_found', 'forbidden', 'unauthenticated', 'invalid', 'conflict', 'invalid_credentials'] as const)(
    'never retries %s: asking again gets the same answer',
    (code) => {
      expect(shouldRetry(0, new ApiError(code, 'x'))).toBe(false)
    },
  )
})

describe('the query client', () => {
  it('asks the server once, not twice, when the answer is "no such trip"', async () => {
    const client = createQueryClient()
    const queryFn = vi.fn().mockRejectedValue(new ApiError('not_found', 'That trip does not exist.'))

    await expect(client.fetchQuery({ queryKey: ['trip', 'gone'], queryFn })).rejects.toThrow('That trip does not exist.')

    expect(queryFn).toHaveBeenCalledTimes(1)
  })

  it('reports a failed read that says the session ended, once, without retrying it', async () => {
    const listener = vi.fn()
    stops.push(onSessionEnded(listener))
    const client = createQueryClient()
    const queryFn = vi.fn().mockRejectedValue(new ApiError('unauthenticated', 'Sign in to do that.'))

    await expect(client.fetchQuery({ queryKey: ['trips'], queryFn })).rejects.toThrow('Sign in to do that.')
    await tick()

    expect(queryFn).toHaveBeenCalledTimes(1)
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('reports a failed change that says the session ended', async () => {
    const listener = vi.fn()
    stops.push(onSessionEnded(listener))
    const client = createQueryClient()
    const mutationFn = vi.fn().mockRejectedValue(new ApiError('unauthenticated', 'Sign in to do that.'))

    await expect(new MutationObserver(client, { mutationFn }).mutate('hello')).rejects.toThrow('Sign in to do that.')
    await tick()

    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('does not report an ordinary refusal as the session ending', async () => {
    const listener = vi.fn()
    stops.push(onSessionEnded(listener))
    const client = createQueryClient()

    await expect(
      client.fetchQuery({
        queryKey: ['members', 't'],
        queryFn: () => Promise.reject(new ApiError('forbidden', 'Only the trip owner can make a new code.')),
      }),
    ).rejects.toThrow()
    await expect(
      new MutationObserver(client, {
        mutationFn: () => Promise.reject(new ApiError('invalid', 'Type something first.')),
      }).mutate(undefined),
    ).rejects.toThrow()
    await tick()

    expect(listener).not.toHaveBeenCalled()
  })

  it('keeps the quiet defaults: reads stay fresh for a while and do not refetch on focus', () => {
    const defaults = createQueryClient().getDefaultOptions().queries

    expect(defaults?.staleTime).toBe(30_000)
    expect(defaults?.refetchOnWindowFocus).toBe(false)
  })
})
