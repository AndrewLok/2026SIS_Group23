import * as React from 'react'
import { useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Fuel, Loader2, Plus, Trash2 } from 'lucide-react'
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
} from '@/hooks/queries'
import { useCurrentUserId } from '@/hooks/useSession'
import { computeFuel, fuelShareFor, totalFuelCents, totalsForLeg } from '@/lib/fuel'
import { formatMoney } from '@/lib/money'
import type { FuelLeg, Profile } from '@/types'

const legSchema = z.object({
  label: z.string().min(1, 'Name the leg, like "Lorne to Apollo Bay".'),
  distanceKm: z.coerce.number().positive('Enter a distance above zero.'),
  efficiencyL100km: z.coerce.number().positive('Enter litres per 100 km.'),
  pricePerLitreCents: z.coerce.number().positive('Enter cents per litre.'),
  driverId: z.string().min(1),
})

function AddLegDrawer({
  tripId,
  members,
  userId,
  defaults,
}: {
  tripId: string
  members: Profile[]
  userId: string
  defaults: { efficiency: number; priceCents: number }
}) {
  const [open, setOpen] = React.useState(false)
  const [riderIds, setRiderIds] = React.useState<string[]>(members.map((m) => m.id))
  const create = useCreateFuelLeg(tripId)

  const form = useForm<z.input<typeof legSchema>>({
    resolver: zodResolver(legSchema),
    defaultValues: {
      label: '',
      distanceKm: '' as unknown as number,
      efficiencyL100km: defaults.efficiency as unknown as number,
      pricePerLitreCents: defaults.priceCents as unknown as number,
      driverId: userId,
    },
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
    setRiderIds((current) =>
      current.includes(id) ? current.filter((r) => r !== id) : [...current, id],
    )

  const submit = form.handleSubmit(async (values) => {
    if (riderIds.length === 0) {
      toast.error('Pick at least one person to chip in.')
      return
    }
    try {
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
      form.reset()
      setRiderIds(members.map((m) => m.id))
    } catch {
      toast.error('Could not add that leg.')
    }
  })

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button>
          <Plus size={15} aria-hidden="true" />
          Add a leg
        </Button>
      </DrawerTrigger>
      <DrawerContent>
        <div className="mx-auto w-full max-w-md">
          <DrawerHeader>
            <DrawerTitle>Add a fuel leg</DrawerTitle>
            <DrawerDescription>
              The driver pays at the pump, and it splits across the riders only.
            </DrawerDescription>
          </DrawerHeader>
          <form onSubmit={submit} className="flex flex-col gap-5 px-4 pb-4" noValidate>
            <Field label="Leg" error={form.formState.errors.label?.message} required>
              {({ id, describedBy, invalid }) => (
                <Input
                  id={id}
                  placeholder="Lorne to Apollo Bay"
                  aria-describedby={describedBy}
                  aria-invalid={invalid}
                  {...form.register('label')}
                />
              )}
            </Field>

            <div className="grid grid-cols-3 gap-3">
              <Field label="Distance km" error={form.formState.errors.distanceKm?.message}>
                {({ id }) => (
                  <Input id={id} inputMode="decimal" className="font-mono" {...form.register('distanceKm')} />
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
                value={
                  <span className="text-radium">{formatMoney(preview.perRiderCents)}</span>
                }
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

            <fieldset className="flex flex-col gap-3">
              <legend className="placard text-[0.6875rem]">Who is chipping in</legend>
              {members.map((m) => (
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
                Add leg and charge riders
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
  onDelete,
}: {
  leg: FuelLeg
  profiles: Map<string, Profile>
  onDelete: () => void
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
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="icon" className="size-8 shrink-0 text-placard">
              <Trash2 size={14} aria-hidden="true" />
              <span className="sr-only">Delete {leg.label}</span>
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this leg?</AlertDialogTitle>
              <AlertDialogDescription>
                The {formatMoney(totals.costCents)} expense it created goes with it, and everyone
                who was chipping in stops carrying their share.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep it</AlertDialogCancel>
              <AlertDialogAction onClick={onDelete}>Delete leg</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
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
  const members = useMembers(tripId)
  const legs = useFuelLegs(tripId)
  const removeLeg = useRemoveFuelLeg(tripId)

  const profiles = React.useMemo(
    () => new Map((members.data ?? []).map((m) => [m.userId, m.profile])),
    [members.data],
  )

  if (trip.isPending || members.isPending || legs.isPending) return <ListSkeleton rows={3} />

  // A failed load must say so rather than falling through to an empty state.
  const queries = [trip, members, legs]
  if (anyFailed(queries)) return <ScreenError queries={queries} />

  const allLegs = legs.data ?? []
  const memberProfiles = (members.data ?? []).map((m) => m.profile)
  const tripTotal = totalFuelCents(allLegs)
  const myShare = fuelShareFor(allLegs, userId)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Fuel and travel"
        subtitle="A leg splits across its riders only, which makes it the one exception to even splits."
        action={
          <AddLegDrawer
            tripId={tripId}
            members={memberProfiles}
            userId={userId}
            defaults={{
              efficiency: trip.data?.defaultEfficiency ?? 8,
              priceCents: trip.data?.defaultPricePerLitreCents ?? 195,
            }}
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
              onDelete={async () => {
                await removeLeg.mutateAsync(leg.id)
                toast.success('Leg deleted, along with its expense.')
              }}
            />
          ))}
        </ul>
      )}

      <Placard className="self-start">Fuel is the exception</Placard>
      <p className="-mt-3 text-xs text-muted-foreground">
        Every other expense splits across all members. A fuel leg splits across its riders, and
        shows on the money screen as a read-only row linking back here.
      </p>
    </div>
  )
}
