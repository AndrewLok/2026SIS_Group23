import * as React from 'react'
import { useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Bed, Car, Loader2, Luggage, MoveRight, Pencil, Plane, Plus, Sparkles, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer'
import { Field } from '@/components/common/Field'
import { MoneyInput } from '@/components/common/money'
import { PageHeader, Placard, SpecRow } from '@/components/common/chrome'
import { EmptyState, ListSkeleton, ScreenError, anyFailed } from '@/components/common/state'
import {
  useBookings,
  useCreateBooking,
  useCreateExpense,
  useMembers,
  useRemoveBooking,
  useTrip,
  useUpdateBooking,
} from '@/hooks/queries'
import { useCurrentUserId } from '@/hooks/useSession'
import { bookingFormOf, bookingPatch, GROUP } from '@/lib/bookingEdit'
import { formatDayTime } from '@/lib/dates'
import { messageFor } from '@/lib/errors'
import { RECOMMENDATIONS, prefillFor, type Recommendation } from '@/lib/recommendations'
import { isoToDay } from '@/lib/dates'
import { formatMoney } from '@/lib/money'
import type { Booking, BookingType, Profile } from '@/types'

const typeMeta: Record<BookingType, { label: string; plural: string; icon: typeof Plane }> = {
  flight: { label: 'Flight', plural: 'Flights', icon: Plane },
  stay: { label: 'Stay', plural: 'Stays', icon: Bed },
  car: { label: 'Car', plural: 'Cars', icon: Car },
  other: { label: 'Other', plural: 'Other', icon: Luggage },
}

// The length limits are the server's (backend common/Limits.java); the inputs stop typing at them.
const TITLE_MAX = 100
const PROVIDER_MAX = 100
const REFERENCE_MAX = 50
const PLACE_MAX = 200
const NOTES_MAX = 2000

const bookingSchema = z.object({
  type: z.enum(['flight', 'stay', 'car', 'other']),
  title: z
    .string()
    .min(1, 'Give the booking a title.')
    .max(TITLE_MAX, `Keep the title to ${TITLE_MAX} characters or fewer.`),
  provider: z.string().max(PROVIDER_MAX),
  reference: z.string().max(REFERENCE_MAX),
  startsAt: z.string(),
  endsAt: z.string(),
  origin: z.string().max(PLACE_MAX),
  destination: z.string().max(PLACE_MAX),
  notes: z.string().max(NOTES_MAX),
  belongsTo: z.string(),
})

const EMPTY_BOOKING: z.infer<typeof bookingSchema> = {
  type: 'flight',
  title: '',
  provider: '',
  reference: '',
  startsAt: '',
  endsAt: '',
  origin: '',
  destination: '',
  notes: '',
  belongsTo: GROUP,
}

/**
 * Adds a booking, or with `booking` given, changes that one. The same form either way. With `start`
 * (a recommendation) it adds a booking, but opens with the recommendation filled in, and its own button.
 */
function BookingDrawer({
  tripId,
  members,
  userId,
  booking,
  start,
}: {
  tripId: string
  members: Profile[]
  userId: string
  booking?: Booking
  start?: { form: z.infer<typeof bookingSchema>; costCents: number; trigger: React.ReactNode }
}) {
  const editing = booking !== undefined
  const [open, setOpen] = React.useState(false)
  const [costCents, setCostCents] = React.useState<number | null>(
    booking?.costCents ?? start?.costCents ?? null,
  )
  const [alsoExpense, setAlsoExpense] = React.useState(false)
  const create = useCreateBooking(tripId)
  const update = useUpdateBooking(tripId)
  const createExpense = useCreateExpense(tripId)

  const form = useForm<z.infer<typeof bookingSchema>>({
    resolver: zodResolver(bookingSchema),
    defaultValues: booking ? bookingFormOf(booking) : (start?.form ?? EMPTY_BOOKING),
  })

  // Opening it to change a booking starts from what the booking says now, not from an earlier look.
  const onOpenChange = (next: boolean) => {
    if (next && booking) {
      form.reset(bookingFormOf(booking))
      setCostCents(booking.costCents)
    }
    if (next && start) {
      form.reset(start.form)
      setCostCents(start.costCents)
      setAlsoExpense(false)
    }
    setOpen(next)
  }

  const type = form.watch('type')

  const submit = form.handleSubmit(async (values) => {
    if (booking) {
      const patch = bookingPatch(booking, values, costCents)
      if (Object.keys(patch).length === 0) {
        setOpen(false)
        return
      }
      try {
        await update.mutateAsync({ bookingId: booking.id, patch })
        toast.success('Booking changed.')
        setOpen(false)
      } catch (error) {
        toast.error(messageFor(error, 'Could not change that booking.'))
      }
      return
    }
    try {
      await create.mutateAsync({
        type: values.type,
        title: values.title,
        provider: values.provider,
        reference: values.reference,
        startsAt: values.startsAt ? new Date(values.startsAt).toISOString() : null,
        endsAt: values.endsAt ? new Date(values.endsAt).toISOString() : null,
        origin: values.origin,
        destination: values.destination,
        costCents,
        belongsTo: values.belongsTo === 'group' ? null : values.belongsTo,
        notes: values.notes,
      })

      // Never silently: adding the cost to the ledger is opt-in on this form.
      if (alsoExpense && costCents !== null && costCents > 0) {
        try {
          await createExpense.mutateAsync({
            description: values.title,
            amountCents: costCents,
            paidBy: values.belongsTo === 'group' ? userId : values.belongsTo,
            spentAt: new Date().toISOString(),
            category: values.type === 'stay' ? 'stay' : 'transport',
            // A group expense: split evenly across everyone, as it always has been.
            split: null,
          })
          toast.success('Booking saved and added as a group expense.')
        } catch (error) {
          // The booking is already saved by now, so say so rather than reporting a failed save.
          toast.error(`Booking saved, but not added as an expense. ${messageFor(error, 'Try adding it on the money screen.')}`)
        }
      } else {
        toast.success('Booking saved.')
      }

      setOpen(false)
      form.reset(start?.form ?? EMPTY_BOOKING)
      setCostCents(start?.costCents ?? null)
      setAlsoExpense(false)
    } catch (error) {
      // The server words its refusals to be read as they are ("It cannot end before it starts.").
      toast.error(messageFor(error, 'Could not save that booking.'))
    }
  })

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerTrigger asChild>
        {start ? (
          start.trigger
        ) : editing ? (
          <Button variant="ghost" size="icon" className="size-8 text-placard">
            <Pencil size={14} aria-hidden="true" />
            <span className="sr-only">Edit {booking.title}</span>
          </Button>
        ) : (
          <Button className="min-h-11">
            <Plus size={16} aria-hidden="true" />
            Add booking
          </Button>
        )}
      </DrawerTrigger>
      <DrawerContent>
        <div className="mx-auto w-full max-w-md overflow-y-auto">
          <DrawerHeader>
            <DrawerTitle>{editing ? 'Edit booking' : 'Add a booking'}</DrawerTitle>
            <DrawerDescription>
              {editing
                ? 'Change what the record says. Nothing is rebooked or checked with the airline.'
                : 'Nothing is looked up or checked against an airline. Type in what your confirmation says.'}
            </DrawerDescription>
          </DrawerHeader>
          <form onSubmit={submit} className="flex flex-col gap-5 px-4 pb-4" noValidate>
            <Field label="Type">
              {({ id }) => (
                <Select
                  value={type}
                  onValueChange={(v) => form.setValue('type', v as BookingType)}
                >
                  <SelectTrigger id={id}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(typeMeta) as BookingType[]).map((t) => (
                      <SelectItem key={t} value={t}>
                        {typeMeta[t].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </Field>

            <Field label={type === 'flight' ? 'Flight number' : 'Title'} error={form.formState.errors.title?.message} required>
              {({ id, describedBy, invalid }) => (
                <Input
                  id={id}
                  placeholder={type === 'flight' ? 'QF 425 SYD to MEL' : 'Beach house, Lorne'}
                  aria-describedby={describedBy}
                  aria-invalid={invalid}
                  maxLength={TITLE_MAX}
                  {...form.register('title')}
                />
              )}
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label={type === 'flight' ? 'Airline' : 'Provider'}>
                {({ id }) => <Input id={id} maxLength={PROVIDER_MAX} {...form.register('provider')} />}
              </Field>
              <Field label={type === 'flight' ? 'PNR' : 'Reference'}>
                {({ id }) => (
                  <Input id={id} className="font-mono" maxLength={REFERENCE_MAX} {...form.register('reference')} />
                )}
              </Field>
            </div>

            {/* Type-specific fields, rather than one form pretending to fit everything. */}
            {type === 'flight' || type === 'car' ? (
              <div className="grid grid-cols-2 gap-4">
                <Field label="From">
                  {({ id }) => (
                    <Input id={id} placeholder="SYD" maxLength={PLACE_MAX} {...form.register('origin')} />
                  )}
                </Field>
                <Field label="To">
                  {({ id }) => (
                    <Input id={id} placeholder="MEL" maxLength={PLACE_MAX} {...form.register('destination')} />
                  )}
                </Field>
              </div>
            ) : (
              <Field label="Address">
                {({ id }) => (
                  <Input
                    id={id}
                    placeholder="18 Mountjoy Parade, Lorne"
                    maxLength={PLACE_MAX}
                    {...form.register('destination')}
                  />
                )}
              </Field>
            )}

            <div className="grid grid-cols-2 gap-4">
              <Field label={type === 'stay' ? 'Check in' : 'Departs'}>
                {({ id }) => <Input id={id} type="datetime-local" {...form.register('startsAt')} />}
              </Field>
              <Field label={type === 'stay' ? 'Check out' : 'Arrives'}>
                {({ id }) => <Input id={id} type="datetime-local" {...form.register('endsAt')} />}
              </Field>
            </div>

            <Field label="Whose booking">
              {({ id }) => (
                <Select
                  value={form.watch('belongsTo')}
                  onValueChange={(v) => form.setValue('belongsTo', v)}
                >
                  <SelectTrigger id={id}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="group">The whole group</SelectItem>
                    {members.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.displayName}
                        {m.id === userId ? ' (you)' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </Field>

            <Field
              label="Cost"
              hint={
                editing
                  ? 'Optional. Changing it does not change anything on the money screen.'
                  : 'Optional. Entering it does not add it to the money screen on its own.'
              }
            >
              {({ id }) => (
                <MoneyInput id={id} valueCents={costCents} onChangeCents={setCostCents} />
              )}
            </Field>

            {!editing && costCents !== null && costCents > 0 ? (
              <div className="flex items-start gap-3">
                <Checkbox
                  id="also-expense"
                  checked={alsoExpense}
                  onCheckedChange={(c) => setAlsoExpense(c === true)}
                />
                <Label htmlFor="also-expense" className="text-sm font-normal leading-snug">
                  Also add {formatMoney(costCents)} as a group expense
                </Label>
              </div>
            ) : null}

            <Field label="Notes">
              {({ id }) => <Textarea id={id} rows={2} maxLength={NOTES_MAX} {...form.register('notes')} />}
            </Field>

            <DrawerFooter className="px-0">
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? (
                  <Loader2 size={15} className="animate-spin" aria-hidden="true" />
                ) : null}
                {editing ? 'Save changes' : 'Save booking'}
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                No real booking is made in Voyager. This is a record of one you already have.
              </p>
            </DrawerFooter>
          </form>
        </div>
      </DrawerContent>
    </Drawer>
  )
}

/**
 * Two suggestions at the top of the screen. They are fixed examples, the same on every trip, not
 * looked up anywhere. Adding one opens the ordinary booking form, filled in, so the cost can go on
 * the group's money screen and the trip's estimate from there.
 */
function RecommendedBookings({
  tripId,
  members,
  userId,
  tripStartDay,
  taken,
}: {
  tripId: string
  members: Profile[]
  userId: string
  tripStartDay: string | null
  taken: Set<string>
}) {
  const open = RECOMMENDATIONS.filter((r) => !taken.has(r.title))
  if (open.length === 0) return null
  const people = Math.max(1, members.length)

  const card = (rec: Recommendation) => {
    const Icon = typeMeta[rec.type].icon
    return (
      <li key={rec.id} className="plate flex flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="flex items-center gap-2 text-sm font-medium">
              <Icon size={14} strokeWidth={1.75} aria-hidden="true" />
              <span className="truncate">{rec.title}</span>
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {rec.provider} · {rec.destination}
            </p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">{rec.blurb}</p>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <span className="tabular text-lg">{formatMoney(rec.costCents)}</span>
            <span className="tabular ml-2 text-xs text-muted-foreground">
              about {formatMoney(Math.ceil(rec.costCents / people))} each for {people}
            </span>
          </div>
          <BookingDrawer
            tripId={tripId}
            members={members}
            userId={userId}
            start={{
              form: prefillFor(rec, tripStartDay),
              costCents: rec.costCents,
              trigger: (
                <Button variant="outline" size="sm" className="min-h-9">
                  <Plus size={14} aria-hidden="true" />
                  Add {rec.title}
                </Button>
              ),
            }}
          />
        </div>
      </li>
    )
  }

  return (
    <section className="flex flex-col gap-3" aria-label="Recommended bookings">
      <div className="flex items-center gap-3">
        <h2 className="placard flex items-center gap-2 text-xs">
          <Sparkles size={13} strokeWidth={1.75} aria-hidden="true" />
          Recommended for this trip
        </h2>
        <span className="h-px flex-1 bg-bezel" aria-hidden="true" />
      </div>
      <ul className="grid gap-3 md:grid-cols-2">{open.map(card)}</ul>
    </section>
  )
}

function BookingCard({
  booking,
  profiles,
  canDelete,
  edit,
  onDelete,
}: {
  booking: Booking
  profiles: Map<string, Profile>
  canDelete: boolean
  /** The edit button, for those who may change it (the same people who may delete it). */
  edit: React.ReactNode
  onDelete: () => void
}) {
  const owner = booking.belongsTo ? profiles.get(booking.belongsTo) : null
  const personal = Boolean(booking.belongsTo)

  return (
    <li
      className={[
        'plate flex flex-col gap-3 p-4',
        // A personal booking is visually distinct without becoming a second card style.
        personal ? 'border-dashed' : '',
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-medium">{booking.title}</h3>
          <p className="mt-1 truncate text-xs text-muted-foreground">
            {[booking.provider, booking.reference].filter(Boolean).join(' · ') || 'No reference'}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Placard className={personal ? 'border-caution/40 text-caution' : ''}>
            {personal ? (owner?.displayName.split(' ')[0] ?? 'personal') : 'group'}
          </Placard>
          {canDelete ? edit : null}
          {canDelete ? (
            <Button variant="ghost" size="icon" className="size-8 text-placard" onClick={onDelete}>
              <Trash2 size={14} aria-hidden="true" />
              <span className="sr-only">Delete {booking.title}</span>
            </Button>
          ) : null}
        </div>
      </div>

      <div className="recessed rounded-sm px-4 py-1">
        {booking.origin || booking.destination ? (
          <SpecRow
            label={booking.type === 'stay' ? 'Where' : 'Route'}
            value={
              booking.type === 'stay' ? (
                booking.destination || 'Not set'
              ) : (
                /*
                 * The route arrow is drawn from the icon set. A Unicode arrow
                 * standing in for an icon is the one thing the craft floor bans
                 * outright, and it renders in whatever the system font decides.
                 */
                <span className="inline-flex items-center gap-2">
                  {booking.origin || 'Not set'}
                  <MoveRight
                    size={14}
                    strokeWidth={1.75}
                    className="text-placard"
                    aria-label="to"
                  />
                  {booking.destination || 'Not set'}
                </span>
              )
            }
          />
        ) : null}
        {booking.startsAt ? (
          <SpecRow
            label={booking.type === 'stay' ? 'Check in' : 'Departs'}
            value={formatDayTime(booking.startsAt)}
          />
        ) : null}
        {booking.endsAt ? (
          <SpecRow
            label={booking.type === 'stay' ? 'Check out' : 'Arrives'}
            value={formatDayTime(booking.endsAt)}
          />
        ) : null}
        {booking.costCents !== null ? (
          <SpecRow label="Cost" value={formatMoney(booking.costCents)} />
        ) : null}
      </div>

      {booking.notes ? <p className="text-xs text-muted-foreground">{booking.notes}</p> : null}
    </li>
  )
}

export function BookingsPage() {
  const { tripId = '' } = useParams<{ tripId: string }>()
  const userId = useCurrentUserId()
  const bookings = useBookings(tripId)
  // Live: "whose booking" offers whoever is on the trip right now.
  const members = useMembers(tripId, true)
  const trip = useTrip(tripId)
  const removeBooking = useRemoveBooking(tripId)

  const profiles = React.useMemo(
    () => new Map((members.data ?? []).map((m) => [m.userId, m.profile])),
    [members.data],
  )

  if (bookings.isPending || members.isPending) return <ListSkeleton rows={4} />

  // A failed load must say so rather than falling through to an empty state.
  const queries = [bookings, members]
  if (anyFailed(queries)) return <ScreenError queries={queries} />

  // The person who added it, the person it is for, and the trip's owner can delete it. (The server
  // decides; this only stops offering a button that would be refused. Where nobody is recorded as
  // having added it, as in the demo, anyone can.)
  const isOwner = (members.data ?? []).some((m) => m.userId === userId && m.role === 'owner')
  const canDelete = (b: Booking): boolean =>
    isOwner || b.createdBy === null || b.createdBy === userId || b.belongsTo === userId

  const all = bookings.data ?? []
  const memberProfiles = (members.data ?? []).map((m) => m.profile)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Bookings"
        subtitle="Flights, stays and cars you have already booked elsewhere. Anything with a time shows on the calendar."
        action={<BookingDrawer tripId={tripId} members={memberProfiles} userId={userId} />}
      />

      <RecommendedBookings
        tripId={tripId}
        members={memberProfiles}
        userId={userId}
        tripStartDay={trip.data?.startDate ? isoToDay(trip.data.startDate) : null}
        taken={new Set(all.map((b) => b.title))}
      />

      {all.length === 0 ? (
        <EmptyState
          icon={Plane}
          line="Nothing recorded yet. Add a flight or a stay and it lands on the shared calendar."
        />
      ) : (
        (Object.keys(typeMeta) as BookingType[]).map((type) => {
          const group = all.filter((b) => b.type === type)
          if (group.length === 0) return null
          const Icon = typeMeta[type].icon
          return (
            <section key={type} className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <h2 className="placard flex items-center gap-2 text-xs">
                  <Icon size={13} strokeWidth={1.75} aria-hidden="true" />
                  {typeMeta[type].plural}
                </h2>
                <span className="h-px flex-1 bg-bezel" aria-hidden="true" />
              </div>
              <ul className="flex flex-col gap-3">
                {group.map((booking) => (
                  <BookingCard
                    key={booking.id}
                    booking={booking}
                    profiles={profiles}
                    canDelete={canDelete(booking)}
                    edit={
                      <BookingDrawer
                        tripId={tripId}
                        members={memberProfiles}
                        userId={userId}
                        booking={booking}
                      />
                    }
                    onDelete={async () => {
                      try {
                        await removeBooking.mutateAsync(booking.id)
                        toast.success('Booking removed.')
                      } catch (error) {
                        toast.error(messageFor(error, 'Could not remove that booking.'))
                      }
                    }}
                  />
                ))}
              </ul>
            </section>
          )
        })
      )}

      <p className="text-xs text-muted-foreground">
        No live flight tracking. Details are whatever the person who booked it typed in.
      </p>
    </div>
  )
}
