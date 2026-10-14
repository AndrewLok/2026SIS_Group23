import * as React from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { addMinutes } from 'date-fns'
import { CalendarPlus, Download, Plane } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { PageHeader, Placard, SpecRow } from '@/components/common/chrome'
import { ListSkeleton, ScreenError, anyFailed } from '@/components/common/state'
import { MemberAvatar } from '@/components/common/people'
import { ScheduleView } from '@/components/activities/ScheduleView'
import { AddActivityDrawer } from '@/components/activities/AddActivityDrawer'
import { useBookings, useIdeas, useMembers, useTrip, useVotes } from '@/hooks/queries'
import { useCurrentUserId } from '@/hooks/useSession'
import { scheduleDays, scheduleEntries } from '@/lib/schedule'
import type { ActivityPreset, ScheduleEntry } from '@/lib/schedule'
import { formatDayTime, formatDayTimeRange, toLocalInput } from '@/lib/dates'

/** Where "open" goes for each kind of block. */
function linkFor(tripId: string, entry: ScheduleEntry): { to: string; label: string } {
  if (entry.kind === 'booking') return { to: `/trips/${tripId}/bookings`, label: 'Open in bookings' }
  if (entry.kind === 'proposal') {
    return {
      to: `/trips/${tripId}/activities?tab=voting&focus=${entry.refId}`,
      label: 'Go to the vote',
    }
  }
  return { to: `/trips/${tripId}/activities?focus=${entry.refId}`, label: 'Open in activities' }
}

/*
 * Placeholders: no calendar sync exists yet. They are here so the screen shows
 * where it will live, and say so plainly when pressed rather than doing nothing.
 */
function ExportButtons() {
  const notYet = (where: string) => () =>
    toast.info(`Adding to ${where} is coming soon.`, {
      description: 'The trip calendar cannot be exported yet.',
    })
  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" size="sm" className="min-h-9" onClick={notYet('Google Calendar')}>
        <CalendarPlus size={14} aria-hidden="true" />
        Add to Google Calendar
      </Button>
      <Button variant="outline" size="sm" className="min-h-9" onClick={notYet('iCalendar')}>
        <Download size={14} aria-hidden="true" />
        Add to iCalendar
      </Button>
    </div>
  )
}

export function CalendarPage() {
  const { tripId = '' } = useParams<{ tripId: string }>()
  const navigate = useNavigate()
  const userId = useCurrentUserId()
  const trip = useTrip(tripId)
  const ideas = useIdeas(tripId)
  const votes = useVotes(tripId)
  const members = useMembers(tripId)
  const bookings = useBookings(tripId)
  const [open, setOpen] = React.useState<ScheduleEntry | null>(null)
  const [drawerOpen, setDrawerOpen] = React.useState(false)
  const [preset, setPreset] = React.useState<ActivityPreset>({ mode: 'vote', start: '', end: '' })

  const profiles = React.useMemo(
    () => new Map((members.data ?? []).map((m) => [m.userId, m.profile])),
    [members.data],
  )
  // Stable between renders, so the drawer does not reset while someone types.
  const memberProfiles = React.useMemo(
    () => (members.data ?? []).map((m) => m.profile),
    [members.data],
  )

  if (ideas.isPending || bookings.isPending || votes.isPending || members.isPending) {
    return <ListSkeleton rows={4} />
  }

  // A failed load must say so rather than falling through to an empty grid.
  const queries = [ideas, bookings, votes, members]
  if (anyFailed(queries)) return <ScreenError queries={queries} />

  const entries = scheduleEntries(ideas.data ?? [], votes.data ?? [], bookings.data ?? [], profiles)
  const link = open ? linkFor(tripId, open) : null

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Calendar"
        subtitle="Every day of the trip, hour by hour. The white space is free time: pick a slot to put an activity to a vote."
        action={
          <Button asChild variant="outline" size="sm">
            <Link to={`/trips/${tripId}/bookings`}>
              <Plane size={14} aria-hidden="true" />
              Bookings
            </Link>
          </Button>
        }
      />

      <ExportButtons />

      <ScheduleView
        days={scheduleDays(trip.data, entries)}
        entries={entries}
        onOpen={setOpen}
        onAdd={(start) => {
          setPreset({
            mode: 'vote',
            start: toLocalInput(start),
            end: toLocalInput(addMinutes(start, 60)),
          })
          setDrawerOpen(true)
        }}
      />

      <AddActivityDrawer
        tripId={tripId}
        members={memberProfiles}
        userId={userId}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        preset={preset}
        onAdded={(mode) =>
          navigate(`/trips/${tripId}/activities${mode === 'vote' ? '?tab=voting' : ''}`)
        }
      />

      <Sheet open={open !== null} onOpenChange={(o) => !o && setOpen(null)}>
        <SheetContent side="bottom" className="mx-auto max-w-md">
          {open && link ? (
            <>
              <SheetHeader>
                <SheetTitle>{open.title}</SheetTitle>
                <SheetDescription>{formatDayTimeRange(open.startsAt, open.endsAt)}</SheetDescription>
              </SheetHeader>
              <div className="flex flex-col px-4 pb-6">
                <Placard className="mb-3 self-start">{open.label}</Placard>
                {open.detail ? (
                  <p className="mb-3 text-sm text-muted-foreground">{open.detail}</p>
                ) : null}
                <SpecRow label="Starts" value={formatDayTime(open.startsAt)} />
                {open.endsAt ? <SpecRow label="Ends" value={formatDayTime(open.endsAt)} /> : null}
                {open.kind !== 'booking' || open.people.length > 0 ? (
                  <div className="flex flex-col gap-2 py-2.5">
                    <span className="placard text-xs">
                      {open.kind === 'booking' ? 'Whose' : open.kind === 'proposal' ? 'In' : 'Going'}
                    </span>
                    {open.people.length === 0 ? (
                      <span className="text-sm text-placard">Nobody yet</span>
                    ) : (
                      <span className="flex flex-wrap gap-1.5">
                        {open.people.map((p) => (
                          <span
                            key={p.id}
                            className="inline-flex items-center gap-1.5 rounded-full border border-bezel py-0.5 pr-2 pl-0.5 text-xs"
                          >
                            <MemberAvatar profile={p} size={18} />
                            {p.displayName.split(' ')[0]}
                          </span>
                        ))}
                      </span>
                    )}
                  </div>
                ) : null}
                <div className="mt-4">
                  <Button asChild variant="outline" size="sm">
                    <Link to={link.to}>{link.label}</Link>
                  </Button>
                </div>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  )
}
