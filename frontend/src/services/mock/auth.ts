import { latency, read, uid, write } from '@/services/mock/db'
import { DEMO_EMAIL, DEMO_PASSWORD } from '@/services/mock/seed'
import { ApiError, toProfile } from '@/types'
import type { Profile } from '@/types'

export async function getSession(): Promise<Profile | null> {
  await latency()
  const db = read()
  if (!db.sessionUserId) return null
  const row = db.profiles.find((p) => p.id === db.sessionUserId)
  return row ? toProfile(row) : null
}

export async function signIn(email: string, password: string): Promise<Profile> {
  await latency()
  const normalised = email.trim().toLowerCase()
  const db = read()
  const expected = db.credentials[normalised]
  if (!expected || expected !== password) {
    throw new ApiError('invalid_credentials', 'That email and password do not match.')
  }
  const row = db.profiles.find((p) => p.email === normalised)
  if (!row) throw new ApiError('invalid_credentials', 'That email and password do not match.')
  write((draft) => {
    draft.sessionUserId = row.id
  })
  return toProfile(row)
}

export async function signUp(
  displayName: string,
  email: string,
  password: string,
): Promise<Profile> {
  await latency()
  const normalised = email.trim().toLowerCase()
  const trimmedName = displayName.trim()
  if (!trimmedName) throw new ApiError('invalid', 'Enter the name your group will recognise.')
  if (read().profiles.some((p) => p.email === normalised)) {
    throw new ApiError('conflict', 'There is already an account with that email.')
  }
  const profile = write((draft) => {
    const row = {
      id: uid(),
      display_name: trimmedName,
      email: normalised,
      avatar_hue: Math.floor(Math.random() * 360),
    }
    draft.profiles.push(row)
    draft.credentials[normalised] = password
    draft.sessionUserId = row.id
    return row
  })
  return toProfile(profile)
}

/** Signs in as the seeded member so the demo trip can be explored immediately. */
export async function signInAsDemo(): Promise<Profile> {
  return signIn(DEMO_EMAIL, DEMO_PASSWORD)
}

export async function signOut(): Promise<void> {
  await latency()
  write((draft) => {
    draft.sessionUserId = null
  })
}
