import { request } from '@/services/http/request'
import type { Profile } from '@/types'

export async function getSession(): Promise<Profile | null> {
  return (await request<Profile | undefined>('GET', '/auth/session')) ?? null
}

export const signIn = (email: string, password: string): Promise<Profile> =>
  request('POST', '/auth/login', { email, password })

export const signUp = (displayName: string, email: string, password: string): Promise<Profile> =>
  request('POST', '/auth/register', { displayName, email, password })

/** Signs in as the seeded member so the demo trip can be explored immediately. */
export const signInAsDemo = (): Promise<Profile> => request('POST', '/auth/demo')

export const signOut = (): Promise<void> => request('POST', '/auth/logout')
