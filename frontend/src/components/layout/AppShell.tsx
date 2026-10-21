/*
 * App shell and route guard.
 *
 * The panel ground lives here, so every screen sits on the same surface and no
 * page has to remember to paint its own background.
 */

import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useSession } from '@/hooks/useSession'

export function AppShell() {
  return (
    <div className="min-h-dvh bg-panel text-foreground">
      <Outlet />
    </div>
  )
}

/** Shown while the stored session is being read, so nothing flashes to /login. */
function SessionPending() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-panel">
      <span className="flex items-center gap-3 text-placard">
        <Loader2 size={18} className="animate-spin" aria-hidden="true" />
        <span className="placard text-xs">Reading panel</span>
      </span>
    </div>
  )
}

/**
 * Sends an unauthenticated visitor to sign in, remembering where they were
 * headed so an invite link still lands on the right trip afterwards.
 */
export function RequireAuth() {
  const { user, loading } = useSession()
  const location = useLocation()

  if (loading) return <SessionPending />
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return <Outlet />
}

/**
 * Keeps a signed-in member out of /login. Someone who has just signed in is sent on to where they
 * were headed (RequireAuth leaves that in the location state), which matters because this guard
 * and the sign-in form's own redirect both react to the same sign-in and must agree on where.
 */
export function RedirectIfAuthed() {
  const { user, loading } = useSession()
  const location = useLocation()
  if (loading) return <SessionPending />
  if (user) {
    const from = (location.state as { from?: string } | null)?.from
    return <Navigate to={from ?? '/trips'} replace />
  }
  return <Outlet />
}
