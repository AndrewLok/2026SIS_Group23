import * as React from 'react'
import { useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Fuel, Loader2, Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
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
import { PageHeader, Placard, SpecRow } from '@/components/common/chrome'
import { EmptyState, ListSkeleton, ScreenError, anyFailed } from '@/components/common/state'
import {
  useCreateFuelLeg,
  useFuelLegs,
  useMembers,
  useRemoveFuelLeg,
  useTrip,
  useUpdateFuelLeg,
} from '@/hooks/queries'
import { useCurrentUserId } from '@/hooks/useSession'
import { computeFuel, fuelShareFor, totalFuelCents, totalsForLeg } from '@/lib/fuel'
import { messageFor } from '@/lib/errors'
import { legPatch, legPeople } from '@/lib/fuelEdit'
import { formatMoney } from '@/lib/money'
import type { FuelLeg, Profile } from '@/types'

// The most the server accepts. "Fuel: " goes in front of the label to make the expense's description.
const LABEL_MAX = 90
const DISTANCE_MAX = 100_000
const EFFICIENCY_MAX = 100
const PRICE_MAX = 100_000

const legSchema = z.object({
  label: z
    .string()
    .trim()
    .min(1, 'Name the leg, like "Lorne to Apollo Bay".')
    .max(LABEL_MAX, `Keep it to ${LABEL_MAX} characters or fewer.`),
  distanceKm: z.coerce
    .number()
    .positive('Enter a distance above zero.')
    .max(DISTANCE_MAX, 'That distance is too long.'),
  efficiencyL100km: z.coerce
    .number()
    .positive('Enter litres per 100 km.')
    .max(EFFICIENCY_MAX, `That is more than ${EFFICIENCY_MAX} litres per 100 km.`),
  // Whole cents, as the trip's default is kept.
  pricePerLitreCents: z.coerce
    .number()
    .positive('Enter cents per litre.')
    .int('Enter whole cents per litre.')
    .max(PRICE_MAX, 'That price per litre is too high.'),
  driverId: z.string().min(1),
})

/**
 * Adds a leg, or with `leg` given edits one. Editing sends only what changed, and keeps anyone who
 * drove or rode and has since left the trip on the leg unless their tick is taken off.
 */
function LegDrawer({
  tripId,
  members,
  userId,
  defaults,
  leg,
  trigger,
}: {
  tripId: string
  members: Profile[]
  userId: string
  defaults: { efficiency: number; priceCents: number }
  leg?: FuelLeg
  trigger: React.ReactNode
}) {
  const editing = leg !== undefined
  const [open, setOpen] = React.useState(false)
  const people = React.useMemo(() => legPeople(leg, members), [leg, members])
  const everyone = React.useMemo(() => people.map((m) => m.id), [people])
  const [pickedIds, setPickedIds] = React.useState<string[]>(leg?.riderIds ?? everyone)
  // Someone who leaves while the form is open is no longer on the list to tick, so they are dropped
  // here too, instead of being sent along and refused.
  const riderIds = pickedIds.filter((id) => everyone.includes(id))
  const create = useCreateFuelLeg(tripId)
  const update = useUpdateFuelLeg(tripId)

  const initialValues = (): z.input<typeof legSchema> =>
    leg
      ? {
          label: leg.label,
          distanceKm: leg.distanceKm,
          efficiencyL100km: leg.efficiencyL100km,
          pricePerLitreCents: leg.pricePerLitreCents,
          driverId: leg.driverId,
        }
      : {
          label: '',
          distanceKm: '' as unknown as number,
          efficiencyL100km: defaults.efficiency as unknown as number,
          pricePerLitreCents: defaults.priceCents as unknown as number,
          driverId: userId,
        }

  const form = useForm<z.input<typeof legSchema>>({
    resolver: zodResolver(legSchema),
    defaultValues: initialValues(),
  })

  // Live calculation, so all four numbers move as the form is filled.
  const watched = form.watch()
  const preview = computeFuel({
    distanceKm: Number(watched.distanceKm) || 0,
    efficiencyL100km: Number(watched.efficiencyL100km) || 0,
    pricePerLitreCents: Number(watched.pricePerLitreCents) || 0,
    riderCount: riderIds.length,
  })

  const toggleRider = (id: string) =>
    setPickedIds(() =>
      riderIds.includes(id) ? riderIds.filter((r) => r !== id) : [...riderIds, id],
    )

  const startOver = () => {
    form.reset(initialValues())
    setPickedIds(leg?.riderIds ?? everyone)
  }

  const submit = form.handleSubmit(async (values) => {
    if (riderIds.length === 0) {
      toast.error('Pick at least one person to chip in.')
      return
    }
    try {
      if (leg) {
        const patch = legPatch(
          leg,
          {
            label: values.label,
            distanceKm: Number(values.distanceKm),
            efficiencyL100km: Number(values.efficiencyL100km),
            pricePerLitreCents: Number(values.pricePerLitreCents),
            driverId: values.driverId,
          },
          riderIds,
        )
        if (Object.keys(patch).length === 0) {
          setOpen(false)
          return
        }
        await update.mutateAsync({ legId: leg.id, patch })
        toast.success('Leg changed. Its expense and the balances are worked out again.')
        setOpen(false)
        return
      }
      await create.mutateAsync({
        label: values.label,
        distanceKm: Number(values.distanceKm),
        efficiencyL100km: Number(values.efficiencyL100km),
        pricePerLitreCents: Number(values.pricePerLitreCents),
        driverId: values.driverId,
        riderIds,
      })
      toast.success('Leg added, and charged to the riders as an expense.')
      setOpen(false)
      startOver()
    } catch (error) {
      toast.error(
        messageFor(error, editing ? 'Could not change that leg.' : 'Could not add that leg.'),
      )
    }
  })

  return (
    <Drawer
      open={open}
      onOpenChange={(next) => {
        // Opening an edit starts from the leg as it is now, not as it was when the page loaded.
        if (next && editing) startOver()
        setOpen(next)
      }}
    >
      <DrawerTrigger asChild>{trigger}</DrawerTrigger>
      <DrawerContent>
        <div className="mx-auto w-full max-w-md overflow-y-auto">
          <DrawerHeader>
            <DrawerTitle>{editing ? 'Change this fuel leg' : 'Add a fuel leg'}</DrawerTitle>
            <DrawerDescription>
              {editing
                ? 'Its expense is changed to match, and balances are worked out again.'
                : 'The driver pays at the pump, and it splits across the riders only.'}
            </DrawerDescription>
          </DrawerHeader>
          <form onSubmit={submit} className="flex flex-col gap-5 px-4 pb-4" noValidate>
            <Field label="Leg" error={form.formState.errors.label?.message} required>
              {({ id, describedBy, invalid }) => (
                <Input
                  id={id}
                  placeholder="Lorne to Apollo Bay"
                  maxLength={LABEL_MAX}
                  aria-describedby={describedBy}
                  aria-invalid={invalid}
                  {...form.register('label')}
                />
              )}
            </Field>

            <div className="grid grid-cols-3 gap-3">
              <Field label="Distance km" error={form.formState.errors.distanceKm?.message}>
                {({ id }) => (
                  <Input
                    id={id}
                    inputMode="decimal"
                    className="font-mono"
                    {...form.register('distanceKm')}
                  />
                )}
              </Field>
              <Field label="L/100km" error={form.formState.errors.efficiencyL100km?.message}>
                {({ id }) => (
                  <Input
                    id={id}
                    inputMode="decimal"
                    className="font-mono"
                    {...form.register('efficiencyL100km')}
                  />
                )}
              </Field>
              <Field label="Cents/L" error={form.formState.errors.pricePerLitreCents?.message}>
                {({ id }) => (
                  <Input
                    id={id}
                    inputMode="numeric"
                    className="font-mono"
                    {...form.register('pricePerLitreCents')}
                  />
                )}
              </Field>
            </div>

            {/* All four figures, live. */}
            <div className="recessed rounded-sm px-4 py-2">
              <SpecRow label="Litres" value={preview.litres.toFixed(2)} />
              <SpecRow label="Leg cost" value={formatMoney(preview.costCents)} />
              <SpecRow label="Riders" value={String(preview.riderCount)} />
              <SpecRow
                label="Each"
                value={<span className="text-radium">{formatMoney(preview.perRiderCents)}</span>}
              />
            </div>

            <Field label="Driver" hint="Whoever actually pays at the pump.">
              {({ id }) => (
                <Select
                  value={form.watch('driverId')}
                  onValueChange={(v) => form.setValue('driverId', v)}
                >
                  <SelectTrigger id={id}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {people.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.displayName}
                        {m.id === userId ? ' (you)' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </Field>

            <fieldset className="flex flex-col gap-3">
              <legend className="placard caption">Who is chipping in</legend>
              {people.map((m) => (
                <div key={m.id} className="flex items-center gap-3">
                  <Checkbox
                    id={`rider-${m.id}`}
                    checked={riderIds.includes(m.id)}
                    onCheckedChange={() => toggleRider(m.id)}
                  />
                  <Label htmlFor={`rider-${m.id}`} className="text-sm font-normal">
                    {m.displayName}
                    {m.id === userId ? ' (you)' : ''}
                  </Label>
                </div>
              ))}
            </fieldset>

            <DrawerFooter className="px-0">
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? (
                  <Loader2 size={15} className="animate-spin" aria-hidden="true" />
                ) : null}
                {editing ? 'Save changes' : 'Add leg and charge riders'}
              </Button>
            </DrawerFooter>
          </form>
        </div>
      </DrawerContent>
    </Drawer>
  )
}

function LegCard({
  leg,
  profiles,
  canDelete,
  onDelete,
  edit,
}: {
  leg: FuelLeg
  profiles: Map<string, Profile>
  canDelete: boolean
  onDelete: () => void
  /** The edit drawer's trigger, shown to whoever may delete it too: the server allows the same people. */
  edit: React.ReactNode
}) {
  const totals = totalsForLeg(leg)
  const driver = profiles.get(leg.driverId)

  return (
    <li className="plate flex flex-col gap-3 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-medium">{leg.label}</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {driver?.displayName ?? 'Someone'} paid · {leg.riderIds.length} chipping in
          </p>
        </div>
        {canDelete ? (
          <div className="flex shrink-0 items-center">
            {edit}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" className="size-11 shrink-0 text-placard">
                  <Trash2 size={14} aria-hidden="true" />
                  <span className="sr-only">Delete {leg.label}</span>
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this leg?</AlertDialogTitle>
                  <AlertDialogDescription>
                    The {formatMoney(totals.costCents)} expense it created goes with it, and
                    everyone who was chipping in stops carrying their share.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep it</AlertDialogCancel>
                  <AlertDialogAction onClick={onDelete}>Delete leg</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        ) : null}
      </div>

      <div className="recessed rounded-sm px-4 py-1">
        <SpecRow label="Distance" value={`${leg.distanceKm} km`} />
        <SpecRow label="Efficiency" value={`${leg.efficiencyL100km} L/100km`} />
        <SpecRow label="Price" value={`${leg.pricePerLitreCents}c / L`} />
        <SpecRow label="Litres" value={totals.litres.toFixed(2)} />
        <SpecRow label="Leg cost" value={formatMoney(totals.costCents)} />
        <SpecRow
          label="Each rider"
          value={<span className="text-radium">{formatMoney(totals.perRiderCents)}</span>}
        />
      </div>
    </li>
  )
}

export function FuelPage() {
  const { tripId = '' } = useParams<{ tripId: string }>()
  const userId = useCurrentUserId()
  const trip = useTrip(tripId)
  // Live: the riders to pick from are whoever is on the trip right now.
  const members = useMembers(tripId, true)
  const legs = useFuelLegs(tripId)
  const removeLeg = useRemoveFuelLeg(tripId)

  const profiles = React.useMemo(
    () => new Map((members.data ?? []).map((m) => [m.userId, m.profile])),
    [members.data],
  )

  const isOwner = (members.data ?? []).some((m) => m.userId === userId && m.role === 'owner')
  // The server decides, and says so if it is not allowed; this only keeps the button off the ones
  // that would be refused. Null means it is not known who added it (the mock store).
  const canDelete = (leg: FuelLeg): boolean =>
    isOwner || leg.createdBy === null || leg.createdBy === userId || leg.driverId === userId

  if (trip.isPending || members.isPending || legs.isPending) return <ListSkeleton rows={3} />

  // A failed load must say so rather than falling through to an empty state.
  const queries = [trip, members, legs]
  if (anyFailed(queries)) return <ScreenError queries={queries} />

  const allLegs = legs.data ?? []
  const memberProfiles = (members.data ?? []).map((m) => m.profile)
  const tripTotal = totalFuelCents(allLegs)
  const myShare = fuelShareFor(allLegs, userId)
  const defaults = {
    efficiency: trip.data?.defaultEfficiency ?? 8,
    priceCents: trip.data?.defaultPricePerLitreCents ?? 195,
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Fuel and travel"
        subtitle="A leg splits evenly across its riders, and the driver is paid back."
        action={
          <LegDrawer
            tripId={tripId}
            members={memberProfiles}
            userId={userId}
            defaults={defaults}
            trigger={
              <Button className="min-h-11">
                <Plus size={16} aria-hidden="true" />
                Add a leg
              </Button>
            }
          />
        }
      />

      <section className="plate flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 px-5 py-4">
        <span className="placard text-xs">Trip fuel</span>
        <span className="tabular text-sm">
          {formatMoney(tripTotal)} total · your share{' '}
          <span className="text-radium">{formatMoney(myShare)}</span>
        </span>
      </section>

      {allLegs.length === 0 ? (
        <EmptyState
          icon={Fuel}
          line="No legs yet. Add one and it charges the riders automatically, so nobody has to work out the pump split."
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {allLegs.map((leg) => (
            <LegCard
              key={leg.id}
              leg={leg}
              profiles={profiles}
              canDelete={canDelete(leg)}
              edit={
                <LegDrawer
                  tripId={tripId}
                  members={memberProfiles}
                  userId={userId}
                  defaults={defaults}
                  leg={leg}
                  trigger={
                    <Button variant="ghost" size="icon" className="size-11 shrink-0 text-placard">
                      <Pencil size={14} aria-hidden="true" />
                      <span className="sr-only">Edit {leg.label}</span>
                    </Button>
                  }
                />
              }
              onDelete={async () => {
                try {
                  await removeLeg.mutateAsync(leg.id)
                  toast.success('Leg deleted, along with its expense.')
                } catch (error) {
                  toast.error(messageFor(error, 'Could not delete that leg.'))
                }
              }}
            />
          ))}
        </ul>
      )}

      <Placard className="self-start">How fuel splits</Placard>
      <p className="-mt-3 text-xs text-muted-foreground">
        A fuel leg splits evenly across its riders and shows on the money screen as a read-only row
        linking back here. Edit the leg to change who rode.
      </p>
    </div>
  )
}
