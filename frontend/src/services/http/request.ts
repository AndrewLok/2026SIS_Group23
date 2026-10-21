/*
 * The one place that talks HTTP to the Spring backend.
 *
 * Login is a session cookie, so there is nothing to attach to a request: the browser sends the
 * cookie by itself, and in development Vite proxies /api to the backend so the cookie is
 * same-origin. Every failure leaves here as an ApiError, so callers branch on a code and show
 * the message, exactly as they do with the mock layer.
 */

import { ApiError } from '@/types'

const BASE = '/api'

const CODES: ReadonlyArray<ApiError['code']> = [
  'not_found',
  'invalid_credentials',
  'conflict',
  'forbidden',
  'invalid',
  'unavailable',
]

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

export const isString = (value: unknown): value is string => typeof value === 'string'
export const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)
export const isStringOrNull = (value: unknown): value is string | null =>
  value === null || isString(value)

const isApiCode = (value: unknown): value is ApiError['code'] =>
  typeof value === 'string' && (CODES as ReadonlyArray<string>).includes(value)

export const UNAVAILABLE_MESSAGE = 'Could not reach the server. Check your connection and try again.'
export const UNEXPECTED_MESSAGE = 'The server sent something unexpected. Try again in a moment.'

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE'

/** Send a request. Throws only when the network fails; a 4xx or 5xx comes back as a Response. */
export async function send(
  method: Method,
  path: string,
  body?: unknown,
): Promise<Response> {
  try {
    return await fetch(`${BASE}${path}`, {
      method,
      credentials: 'same-origin',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError('unavailable', UNAVAILABLE_MESSAGE)
  }
}

/**
 * Turn a failed response into an ApiError. The backend sends { code, message } with the same codes
 * the frontend already uses; anything else (a proxy error page, an empty 401) falls back to the status.
 */
export async function errorFrom(response: Response): Promise<ApiError> {
  try {
    const body: unknown = await response.json()
    if (isRecord(body) && isApiCode(body.code) && typeof body.message === 'string' && body.message) {
      return new ApiError(body.code, body.message)
    }
  } catch {
    // No body, or not JSON. The status below says enough.
  }

  switch (response.status) {
    case 400:
      return new ApiError('invalid', 'That was not accepted. Check it and try again.')
    case 401:
      return new ApiError('forbidden', 'Sign in to do that.')
    case 403:
      return new ApiError('forbidden', 'You are not allowed to do that.')
    case 404:
      return new ApiError('not_found', 'That could not be found.')
    case 409:
      return new ApiError('conflict', 'That clashes with something that already exists.')
    case 502:
    case 503:
    case 504:
      // What a proxy in front of the backend answers when the backend itself is down.
      return new ApiError('unavailable', UNAVAILABLE_MESSAGE)
    default:
      return new ApiError('unavailable', 'Something went wrong on our side. Try again in a moment.')
  }
}

/** Send a request and throw an ApiError for anything but a 2xx. */
export async function request(
  method: Method,
  path: string,
  body?: unknown,
): Promise<Response> {
  const response = await send(method, path, body)
  if (!response.ok) throw await errorFrom(response)
  return response
}

/** Read a JSON body, treating one that will not parse as the server misbehaving. */
export async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    throw new ApiError('unavailable', UNEXPECTED_MESSAGE)
  }
}
