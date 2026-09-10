/*
 * The frame every trip screen sits in: a top bar that always says which trip you
 * are on, and a bottom nav within thumb reach.
 */

import { NavLink, Outlet, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  CalendarDays,
  Gauge,
  LogOut,
  MessageSquare,
  MoreVertical,
  Plane,
  Users,
  Vote,
  Wallet,
} from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useSession } from '@/hooks/useSession'
import { useTrip } from '@/hooks/queries'
import { cn } from '@/lib/utils'

const navItems = [
  { to: '', label: 'Panel', icon: Gauge, end: true },
  { to: 'voting', label: 'Voting', icon: Vote, end: false },
  { to: 'calendar', label: 'Calendar', icon: CalendarDays, end: false },
  { to: 'expenses', label: 'Money', icon: Wallet, end: false },
  { to: 'chat', label: 'Chat', icon: MessageSquare, end: false },
]

export function BackButton({ to, label }: { to: string; label: string }) {
  return (
    <Button asChild variant="ghost" size="sm" className="-ml-2 text-placard">
      <Link to={to}>
        <ArrowLeft size={15} aria-hidden="true" />
        {label}
      </Link>
    </Button>
  )
}

function TopBar({ tripId }: { tripId: string }) {
  const trip = useTrip(tripId)
  const { signOut } = useSession()
  const navigate = useNavigate()

  return (
    <header className="sticky top-0 z-20 border-b border-bezel bg-panel/95 backdrop-blur-sm">
      <div className="mx-auto flex w-full max-w-4xl items-center gap-3 px-4 py-3 md:px-6">
        <Link
          to="/trips"
          className="placard shrink-0 text-[0.6875rem] hover:text-foreground"
          aria-label="All trips"
        >
          Voyager
        </Link>
        <span className="text-bezel-edge" aria-hidden="true">
          /
        </span>
        <p className="min-w-0 flex-1 truncate text-sm font-medium">
          {trip.data?.name ?? 'Loading trip'}
        </p>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-8 shrink-0">
              <MoreVertical size={16} aria-hidden="true" />
              <span className="sr-only">Trip menu</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem onSelect={() => navigate(`/trips/${tripId}/members`)}>
              <Users size={15} aria-hidden="true" />
              Members and invite
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => navigate(`/trips/${tripId}/bookings`)}>
              <Plane size={15} aria-hidden="true" />
              Bookings
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => navigate(`/trips/${tripId}/fuel`)}>
              <Gauge size={15} aria-hidden="true" />
              Fuel and travel
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => void signOut()}>
              <LogOut size={15} aria-hidden="true" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}

function BottomNav({ tripId }: { tripId: string }) {
  return (
    <nav
      className="sticky bottom-0 z-20 border-t border-bezel bg-panel/95 backdrop-blur-sm"
      aria-label="Trip sections"
    >
      <ul className="mx-auto flex w-full max-w-4xl items-stretch">
        {navItems.map((item) => (
          <li key={item.label} className="flex-1">
            <NavLink
              to={item.to ? `/trips/${tripId}/${item.to}` : `/trips/${tripId}`}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'flex min-h-[3.5rem] flex-col items-center justify-center gap-1 px-1 py-2 transition-colors',
                  isActive ? 'text-radium' : 'text-placard hover:text-foreground',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon size={19} strokeWidth={isActive ? 2.25 : 1.75} aria-hidden="true" />
                  <span className="placard text-[0.5625rem] leading-none">{item.label}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}

export function TripLayout() {
  const { tripId } = useParams<{ tripId: string }>()
  if (!tripId) return null

  return (
    <div className="flex min-h-dvh flex-col bg-panel">
      <TopBar tripId={tripId} />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6 md:px-6 md:py-8">
        <Outlet />
      </main>
      <BottomNav tripId={tripId} />
    </div>
  )
}
