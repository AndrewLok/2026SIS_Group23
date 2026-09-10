import * as React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, LogOut, MapPin, Plus, Ticket } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Field } from '@/components/common/Field'
import { EmptyState, ListSkeleton, QueryBoundary } from '@/components/common/state'
import { PageHeader, Placard } from '@/components/common/chrome'
import { useCreateTrip, useJoinByCode, useTrips } from '@/hooks/queries'
import { useSession } from '@/hooks/useSession'
import { daysUntil, formatDateRange } from '@/lib/dates'
import type { Trip } from '@/types'

const newTripSchema = z.object({
  name: z.string().min(1, 'Give the trip a name.'),
  destination: z.string(),
  startDate: z.string(),
  endDate: z.string(),
})

function NewTripDialog() {
  const [open, setOpen] = React.useState(false)
  const create = useCreateTrip()
  const navigate = useNavigate()
  const form = useForm<z.infer<typeof newTripSchema>>({
    resolver: zodResolver(newTripSchema),
    defaultValues: { name: '', destination: '', startDate: '', endDate: '' },
  })

  const submit = form.handleSubmit(async (values) => {
    try {
      const trip = await create.mutateAsync({
        name: values.name,
        destination: values.destination,
        startDate: values.startDate ? new Date(values.startDate).toISOString() : null,
        endDate: values.endDate ? new Date(values.endDate).toISOString() : null,
      })
      toast.success(`${trip.name} created. Invite code ${trip.inviteCode}.`)
      setOpen(false)
      form.reset()
      navigate(`/trips/${trip.id}`)
    } catch {
      toast.error('Could not create that trip.')
    }
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus size={15} aria-hidden="true" />
          New trip
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Start a trip</DialogTitle>
          <DialogDescription>
            You will be the owner, and you get an invite code to send the others.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
          <Field label="Trip name" error={form.formState.errors.name?.message} required>
            {({ id, describedBy, invalid }) => (
              <Input
                id={id}
                placeholder="Great Ocean Road"
                aria-describedby={describedBy}
                aria-invalid={invalid}
                {...form.register('name')}
              />
            )}
          </Field>
          <Field label="Destination">
            {({ id }) => (
              <Input id={id} placeholder="Victoria, Australia" {...form.register('destination')} />
            )}
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Starts" hint="Optional">
              {({ id }) => <Input id={id} type="date" {...form.register('startDate')} />}
            </Field>
            <Field label="Ends" hint="Optional">
              {({ id }) => <Input id={id} type="date" {...form.register('endDate')} />}
            </Field>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? (
                <Loader2 size={15} className="animate-spin" aria-hidden="true" />
              ) : null}
              Create trip
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function JoinByCodeDialog() {
  const [open, setOpen] = React.useState(false)
  const [code, setCode] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const join = useJoinByCode()
  const navigate = useNavigate()

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    try {
      const trip = await join.mutateAsync(code)
      toast.success(`You are on ${trip.name}`)
      setOpen(false)
      setCode('')
      navigate(`/trips/${trip.id}`)
    } catch {
      setError('That code does not match a trip.')
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Ticket size={15} aria-hidden="true" />
          Join with a code
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Join a trip</DialogTitle>
          <DialogDescription>Six characters, from whoever set the trip up.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
          <Field label="Invite code" error={error ?? undefined} required>
            {({ id, describedBy, invalid }) => (
              <Input
                id={id}
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                maxLength={6}
                autoCapitalize="characters"
                autoComplete="off"
                placeholder="GOR27X"
                aria-describedby={describedBy}
                aria-invalid={invalid}
                className="font-mono text-lg tracking-[0.3em]"
              />
            )}
          </Field>
          <DialogFooter>
            <Button type="submit" disabled={join.isPending || code.length < 6}>
              {join.isPending ? (
                <Loader2 size={15} className="animate-spin" aria-hidden="true" />
              ) : null}
              Join trip
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function TripCard({ trip }: { trip: Trip }) {
  const range = formatDateRange(trip.startDate, trip.endDate)
  const days = daysUntil(trip.startDate)
  const reading =
    days === null
      ? { value: '--', unit: 'no dates' }
      : days > 0
        ? { value: String(days), unit: days === 1 ? 'day to go' : 'days to go' }
        : days === 0
          ? { value: 'Today', unit: 'departs' }
          : { value: String(Math.abs(days)), unit: 'days ago' }

  return (
    <Link
      to={`/trips/${trip.id}`}
      className="plate flex items-center justify-between gap-4 p-4 transition-colors hover:border-bezel-edge"
    >
      <div className="min-w-0">
        <h2 className="truncate text-base font-semibold">{trip.name}</h2>
        <p className="mt-1 flex items-center gap-1.5 truncate text-sm text-muted-foreground">
          <MapPin size={13} strokeWidth={1.75} aria-hidden="true" />
          {trip.destination || 'Destination not set'}
        </p>
        <p className="mt-2 text-xs text-muted-foreground">{range ?? 'Dates not set'}</p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <span
          className="instrument-value text-2xl leading-none"
          style={{ color: days !== null && days >= 0 ? 'var(--radium)' : 'var(--placard)' }}
        >
          {reading.value}
        </span>
        <Placard>{reading.unit}</Placard>
      </div>
    </Link>
  )
}

export function TripsPage() {
  const trips = useTrips()
  const { user, signOut } = useSession()

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 md:px-6 md:py-12">
      <PageHeader
        title="Your trips"
        subtitle={user ? `Signed in as ${user.displayName}` : undefined}
        action={
          <Button variant="ghost" size="sm" className="text-placard" onClick={() => void signOut()}>
            <LogOut size={15} aria-hidden="true" />
            Sign out
          </Button>
        }
      />

      <div className="mt-6 flex flex-wrap gap-3">
        <NewTripDialog />
        <JoinByCodeDialog />
      </div>

      <div className="mt-6">
        <QueryBoundary
          query={trips}
          loading={<ListSkeleton rows={2} />}
          isEmpty={(list) => list.length === 0}
          empty={
            <EmptyState
              icon={MapPin}
              line="No trips yet. Start one and send the code around, or join one someone else set up."
            />
          }
        >
          {(list) => {
            // Upcoming first, then the ones already behind you.
            const sorted = [...list].sort((a, b) => {
              const aDays = daysUntil(a.startDate)
              const bDays = daysUntil(b.startDate)
              const aUpcoming = aDays !== null && aDays >= 0
              const bUpcoming = bDays !== null && bDays >= 0
              if (aUpcoming !== bUpcoming) return aUpcoming ? -1 : 1
              if (aDays === null) return 1
              if (bDays === null) return -1
              return aUpcoming ? aDays - bDays : bDays - aDays
            })
            return (
              <ul className="flex flex-col gap-3">
                {sorted.map((trip) => (
                  <li key={trip.id}>
                    <TripCard trip={trip} />
                  </li>
                ))}
              </ul>
            )
          }}
        </QueryBoundary>
      </div>
    </div>
  )
}
