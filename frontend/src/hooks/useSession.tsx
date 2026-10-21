/*
 * Session. One of only two things held in React Context; everything with a
 * server shape goes through TanStack Query instead.
 */

import * as React from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/services/client'
import { onSessionEnded } from '@/services/sessionEnded'
import { ApiError } from '@/types'
import type { Profile } from '@/types'

type SessionValue = {
  user: Profile | null
  loading: boolean
  /** True after the server ended the session under a signed-in person, until they sign in again. */
  sessionEnded: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (displayName: string, email: string, password: string) => Promise<void>
  signInAsDemo: () => Promise<void>
  signOut: () => Promise<void>
}

const SessionContext = React.createContext<SessionValue | null>(null)

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<Profile | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [sessionEnded, setSessionEnded] = React.useState(false)
  const queryClient = useQueryClient()

  // The listener below must see who is signed in now, not who was when it was set up.
  const signedIn = React.useRef(false)
  React.useEffect(() => {
    signedIn.current = user !== null
  }, [user])

  // The server stopped recognising this login (it ran out, or it was ended on another device).
  // Forget the person and everything fetched for them; the route guard then shows the sign-in
  // screen, which says why, and sends them back to where they were after they sign in again.
  React.useEffect(
    () =>
      onSessionEnded(() => {
        if (!signedIn.current) return
        signedIn.current = false
        setUser(null)
        setSessionEnded(true)
        queryClient.clear()
      }),
    [queryClient],
  )

  React.useEffect(() => {
    let cancelled = false
    api.auth
      .getSession()
      .then((profile) => {
        if (!cancelled) setUser(profile)
      })
      // If the server cannot be reached, the sign-in screen is where the person lands,
      // and signing in will say what is wrong.
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const value = React.useMemo<SessionValue>(
    () => ({
      user,
      loading,
      sessionEnded,
      signIn: async (email, password) => {
        setUser(await api.auth.signIn(email, password))
        setSessionEnded(false)
        await queryClient.invalidateQueries()
      },
      signUp: async (displayName, email, password) => {
        setUser(await api.auth.signUp(displayName, email, password))
        setSessionEnded(false)
        await queryClient.invalidateQueries()
      },
      signInAsDemo: async () => {
        setUser(await api.auth.signInAsDemo())
        setSessionEnded(false)
        await queryClient.invalidateQueries()
      },
      signOut: async () => {
        try {
          await api.auth.signOut()
        } catch (error) {
          // The login cookie is still live on the server, so staying signed in is the honest state.
          toast.error(
            error instanceof ApiError ? error.message : 'Could not sign out. Try again in a moment.',
          )
          return
        }
        setUser(null)
        queryClient.clear()
      },
    }),
    [user, loading, sessionEnded, queryClient],
  )

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession(): SessionValue {
  const value = React.useContext(SessionContext)
  if (!value) throw new Error('useSession must be used inside SessionProvider')
  return value
}

/** The signed-in member's id, for screens that are already behind the route guard. */
export function useCurrentUserId(): string {
  const { user } = useSession()
  if (!user) throw new Error('No session; this screen should be behind a route guard')
  return user.id
}
