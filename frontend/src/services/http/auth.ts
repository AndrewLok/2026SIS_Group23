/*
 * Sign-in against the Spring backend (/api/auth/*), with the same signatures as services/mock/auth.ts
 * so client.ts can swap one for the other.
 *
 * The backend answers with exactly the Profile shape (id, displayName, email, avatarHue), so unlike
 * the mock rows there is no snake_case to map; the response is only checked, not converted.
 */

import { adoptSession } from '@/services/mock/bridge'
import { isRecord, readJson, request, send, errorFrom, UNEXPECTED_MESSAGE } from '@/services/http/request'
import { ApiError } from '@/types'
import type { Profile } from '@/types'

function parseProfile(data: unknown): Profile {
  if (
    !isRecord(data) ||
    typeof data.id !== 'string' ||
    typeof data.displayName !== 'string' ||
    typeof data.email !== 'string' ||
    typeof data.avatarHue !== 'number'
  ) {
    throw new ApiError('unavailable', UNEXPECTED_MESSAGE)
  }
  return {
    id: data.id,
    displayName: data.displayName,
    email: data.email,
    avatarHue: data.avatarHue,
  }
}

/** Who is signed in, or null. A 401 is the normal answer for someone who is not. */
export async function getSession(): Promise<Profile | null> {
  const response = await send('GET', '/auth/me')
  if (response.status === 401) {
    adoptSession(null)
    return null
  }
  if (!response.ok) throw await errorFrom(response)
  const profile = parseProfile(await readJson(response))
  adoptSession(profile)
  return profile
}

export async function signIn(email: string, password: string): Promise<Profile> {
  const response = await request('POST', '/auth/login', { email, password })
  const profile = parseProfile(await readJson(response))
  adoptSession(profile)
  return profile
}

/** Creates the account and signs it in, as the backend does in one step. */
export async function signUp(
  displayName: string,
  email: string,
  password: string,
): Promise<Profile> {
  const response = await request('POST', '/auth/register', { displayName, email, password })
  const profile = parseProfile(await readJson(response))
  adoptSession(profile)
  return profile
}

export async function signOut(): Promise<void> {
  await request('POST', '/auth/logout')
  adoptSession(null)
}
