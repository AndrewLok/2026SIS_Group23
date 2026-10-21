/*
 * The one place the HTTP client talks to fetch.
 *
 * Requests go to /api on the same origin. In development Vite proxies that to the Spring
 * backend (see vite.config.ts), so the session cookie the backend sets is first-party and
 * no CORS set-up is needed.
 *
 * The backend speaks the app's own camelCase shapes, so responses come back as the entity
 * types directly; the snake_case mappers in src/types only matter to the mock store.
 */

import { ApiError } from '@/types'

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

const CODES: ApiError['code'][] = ['not_found', 'invalid_credentials', 'conflict', 'forbidden', 'invalid']

/** Encode one path segment, so an id can never change the route it lands on. */
export const seg = (value: string): string => encodeURIComponent(value)

export async function request<T>(method: Method, path: string, body?: unknown): Promise<T> {
  let response: Response
  try {
    response = await fetch(`/api${path}`, {
      method,
      credentials: 'same-origin',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new Error('Could not reach the server. Is the backend running?')
  }

  if (!response.ok) {
    let code: ApiError['code'] = 'invalid'
    let message = `The server said ${response.status}.`
    try {
      const error = (await response.json()) as { code?: string; message?: string }
      if (error.code && (CODES as string[]).includes(error.code)) code = error.code as ApiError['code']
      if (error.message) message = error.message
    } catch {
      // Not our error shape, e.g. a proxy error page. Keep the generic message.
    }
    if (response.status === 404 && code === 'invalid') code = 'not_found'
    throw new ApiError(code, message)
  }

  if (response.status === 204) return undefined as T
  const text = await response.text()
  return (text ? JSON.parse(text) : undefined) as T
}
