import { describe, expect, it } from 'vitest'
import { messageFor } from '@/lib/errors'
import { ApiError } from '@/types'

describe('messageFor', () => {
  it('uses the words of an ApiError, which are written to be shown', () => {
    expect(messageFor(new ApiError('invalid', 'The trip cannot end before it starts.'), 'Could not save.')).toBe(
      'The trip cannot end before it starts.',
    )
  })

  it('uses the fallback for anything else', () => {
    expect(messageFor(new Error('Cannot read properties of undefined'), 'Could not save.')).toBe('Could not save.')
    expect(messageFor('nope', 'Could not save.')).toBe('Could not save.')
    expect(messageFor(undefined, 'Could not save.')).toBe('Could not save.')
  })

  it('uses the fallback for an ApiError with nothing to say', () => {
    expect(messageFor(new ApiError('unavailable', ''), 'Could not save.')).toBe('Could not save.')
  })
})
