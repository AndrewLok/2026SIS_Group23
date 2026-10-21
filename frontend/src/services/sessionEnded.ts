/*
 * "The server no longer knows who you are."
 *
 * A login lasts as long as the server's session does, and that can end while a screen is open: it
 * ran out, or the person signed out on another device. The next request then comes back 401, which
 * the HTTP layer turns into an ApiError with the code `unauthenticated`. Nothing on a screen should
 * have to cope with that one by one, so the query client reports it here and the session (which
 * lives in React) listens and sends the person back to sign in.
 *
 * This file is only the link between the two, so the HTTP layer never has to import React.
 */

import { ApiError } from '@/types'

type Listener = () => void

const listeners = new Set<Listener>()

/** Listen for the session ending. Returns the function that stops listening. */
export function onSessionEnded(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** True for the error that means "sign in again", and for nothing else. */
export const isSessionEnded = (error: unknown): boolean =>
  error instanceof ApiError && error.code === 'unauthenticated'

/**
 * Tell the listeners if this error is the session ending; ignore any other error. They are told on
 * the next tick rather than inside the query client's own error handling, because the first thing
 * they do is clear that client.
 */
export function reportIfSessionEnded(error: unknown): void {
  if (!isSessionEnded(error)) return
  setTimeout(() => {
    for (const listener of [...listeners]) listener()
  }, 0)
}
