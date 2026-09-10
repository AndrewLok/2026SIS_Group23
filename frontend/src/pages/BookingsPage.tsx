import * as React from 'react'
import { useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Bed, Car, Loader2, Luggage, Plane, Plus, Trash2 } from 'lucide-react'
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
} from '@/hooks/queries'
import { useCurrentUserId } from '@/hooks/useSession'
import { formatDayTime } from '@/lib/dates'
import { formatMoney } from '@/lib/money'
import type { Booking, BookingType, Profile } from '@/types'

const typeMeta: Record<BookingType, { label: string; plural: string; icon: typeof Plane }> = {
  flight: { label: 'Flight', plural: 'Flights', icon: Plane },
  stay: { label: 'Stay', plural: 'Stays', icon: Bed },
  car: { label: 'Car', plural: 'Cars', icon: Car },
  other: { label: 'Other', plural: 'Other', icon: Luggage },
}

const bookingSchema = z.object({
  type: z.enum(['flight', 'stay', 'car', 'other']),
  title: z.string().min(1, 'Give the booking a title.'),
  provider: z.string(),
  reference: z.string(),
  startsAt: z.string(),
  endsAt: z.string(),
  origin: z.string(),
  destination: z.string(),
  notes: z.string(),
  belongsTo: z.string(),
})

function AddBookingDrawer({
  tripId,
  members,
  userId,
}: {
  tripId: string
  members: Profile[]
  userId: string
}) {
  const [open, setOpen] = React.useState(false)
  const [costCents, setCostCents] = React.useState<number | null>(null)
  const [alsoExpense, setAlsoExpense] = React.useState(false)
  const create = useCreateBooking(tripId)
  const createExpense = useCreateExpense(tripId)

  const form = useForm<z.infer<typeof bookingSchema>>({
    resolver: zodResolver(bookingSchema),
    defaultValues: {
      type: 'flight',
      title: '',
      provider: '',
      reference: '',
      startsAt: '',
      endsAt: '',
      origin: '',
      destination: '',
      notes: '',
      belongsTo: 'group',
    },
  })

  const type = form.watch('type')

  const submit = form.handleSubmit(async (values) => {
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
        await createExpense.mutateAsync({
          description: values.title,
          amountCents: costCents,
          paidBy: values.belongsTo === 'group' ? userId : values.belongsTo,
          spentAt: new Date().toISOString(),
          category: values.type === 'stay' ? 'stay' : 'transport',
        })
        toast.success('Booking saved and added as a group expense.')
      } else {
        toast.success('Booking saved.')
      }

      setOpen(false)
      form.reset()
      setCostCents(null)
      setAlsoExpense(false)
    } catch {
      toast.error('Could not save that booking.')
    }
  })

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button>
          <Plus size={15} aria-hidden="true" />
          Add booking
        </Button>
      </DrawerTrigger>
      <DrawerContent>
        <div className="mx-auto w-full max-w-md">
          <DrawerHeader>
            <DrawerTitle>Add a booking</DrawerTitle>
            <DrawerDescription>
              Nothing is looked up or checked against an airline. Type in what your confirmation says.
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
                  {...form.register('title')}
                />
              )}
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label={type === 'flight' ? 'Airline' : 'Provider'}>
                {({ id }) => <Input id={id} {...form.register('provider')} />}
              </Field>
              <Field label={type === 'flight' ? 'PNR' : 'Reference'}>
                {({ id }) => <Input id={id} className="font-mono" {...form.register('reference')} />}
              </Field>
            </div>

            {/* Type-specific fields, rather than one form pretending to fit everything. */}
            {type === 'flight' || type === 'car' ? (
              <div className="grid grid-cols-2 gap-4">
                <Field label="From">
                  {({ id }) => <Input id={id} placeholder="SYD" {...form.register('origin')} />}
                </Field>
                <Field label="To">
                  {({ id }) => <Input id={id} placeholder="MEL" {...form.register('destination')} />}
                </Field>
              </div>
            ) : (
              <Field label="Address">
                {({ id }) => (
                  <Input id={id} placeholder="18 Mountjoy Parade, Lorne" {...form.register('destination')} />
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

            <Field label="Cost" hint="Optional. Entering it does not add it to the money screen on its own.">
              {({ id }) => (
                <MoneyInput id={id} valueCents={costCents} onChangeCents={setCostCents} />
              )}
            </Field>

            {costCents !== null && costCents > 0 ? (
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
              {({ id }) => <Textarea id={id} rows={2} {...form.register('notes')} />}
            </Field>

            <DrawerFooter className="px-0">
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? (
                  <Loader2 size={15} className="animate-spin" aria-hidden="true" />
                ) : null}
                Save booking
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

function BookingCard({
  booking,
  profiles,
  onDelete,
}: {
  booking: Booking
  profiles: Map<string, Profile>
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
          <Button variant="ghost" size="icon" className="size-8 text-placard" onClick={onDelete}>
            <Trash2 size={14} aria-hidden="true" />
            <span className="sr-only">Delete {booking.title}</span>
          </Button>
        </div>
      </div>

      <div className="recessed rounded-sm px-4 py-1">
        {booking.origin || booking.destination ? (
          <SpecRow
            label={booking.type === 'stay' ? 'Where' : 'Route'}
            value={
              booking.type === 'stay'
                ? booking.destination || '—'
                : `${booking.origin || '—'} → ${booking.destination || '—'}`
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
  const members = useMembers(tripId)
  const removeBooking = useRemoveBooking(tripId)

  const profiles = React.useMemo(
    () => new Map((members.data ?? []).map((m) => [m.userId, m.profile])),
    [members.data],
  )

  if (bookings.isPending || members.isPending) return <ListSkeleton rows={4} />

  // A failed load must say so rather than falling through to an empty state.
  const queries = [bookings, members]
  if (anyFailed(queries)) return <ScreenError queries={queries} />

  const all = bookings.data ?? []
  const memberProfiles = (members.data ?? []).map((m) => m.profile)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Bookings"
        subtitle="Flights, stays and cars you have already booked elsewhere. Anything with a time shows on the calendar."
        action={<AddBookingDrawer tripId={tripId} members={memberProfiles} userId={userId} />}
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
                    onDelete={async () => {
                      await removeBooking.mutateAsync(booking.id)
                      toast.success('Booking removed.')
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
