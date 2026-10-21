/*
 * Session. One of only two things held in React Context; everything with a
 * server shape goes through TanStack Query instead.
 */

import * as React from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/services/client'
import { ApiError } from '@/types'
import type { Profile } from '@/types'

type SessionValue = {
  user: Profile | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (displayName: string, email: string, password: string) => Promise<void>
  signInAsDemo: () => Promise<void>
  signOut: () => Promise<void>
}

const SessionContext = React.createContext<SessionValue | null>(null)

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<Profile | null>(null)
  const [loading, setLoading] = React.useState(true)
  const queryClient = useQueryClient()

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
      signIn: async (email, password) => {
        setUser(await api.auth.signIn(email, password))
        await queryClient.invalidateQueries()
      },
      signUp: async (displayName, email, password) => {
        setUser(await api.auth.signUp(displayName, email, password))
        await queryClient.invalidateQueries()
      },
      signInAsDemo: async () => {
        setUser(await api.auth.signInAsDemo())
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
    [user, loading, queryClient],
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
