/*
 * What to tell the person when something failed. The server words its refusals to be read as they
 * are ("The trip cannot end before it starts."), and so do the HTTP client's own errors ("Could not
 * reach the server."), so an ApiError's message goes straight to the screen. Anything else (a bug,
 * not a refusal) gets the fallback written for that spot.
 */

import { ApiError } from '@/types'

export const messageFor = (error: unknown, fallback: string): string =>
  error instanceof ApiError && error.message ? error.message : fallback
