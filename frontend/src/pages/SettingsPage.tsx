import * as React from 'react'
import { useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field } from '@/components/common/Field'
import { MoneyInput } from '@/components/common/money'
import { PageHeader } from '@/components/common/chrome'
import { ListSkeleton, ScreenError, anyFailed } from '@/components/common/state'
import { useMembers, useTrip, useUpdateTrip } from '@/hooks/queries'
import { useCurrentUserId } from '@/hooks/useSession'
import { isoToDay } from '@/lib/dates'
import { messageFor } from '@/lib/errors'
import { formatMoney } from '@/lib/money'
import { detailsPatch, isEmptyPatch, sharedPatch } from '@/lib/tripSettings'
import type { Trip } from '@/types'

// The limits are the server's (backend common/Limits.java and TripService); the inputs stop typing at them.
const NAME_MAX = 100
const DESTINATION_MAX = 100
const MONEY_MAX_CENTS = 10_000_000_000
const EFFICIENCY_MAX = 100
const PRICE_MAX = 100_000

const detailsSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'Give the trip a name.')
      .max(NAME_MAX, `Use ${NAME_MAX} characters or fewer.`),
    destination: z
      .string()
      .trim()
      .max(DESTINATION_MAX, `Use ${DESTINATION_MAX} characters or fewer.`),
    startDate: z.string(),
    endDate: z.string(),
  })
  .refine((v) => !v.startDate || !v.endDate || v.endDate >= v.startDate, {
    path: ['endDate'],
    message: 'The trip cannot end before it starts.',
  })

const sharedSchema = z.object({
  defaultEfficiency: z.coerce
    .number()
    .positive('Enter litres per 100 km.')
    .max(EFFICIENCY_MAX, `That is more than ${EFFICIENCY_MAX} litres per 100 km.`),
  defaultPricePerLitreCents: z.coerce
    .number()
    .int('Enter whole cents per litre.')
    .min(0, 'Enter cents per litre.')
    .max(PRICE_MAX, 'That price per litre is too high.'),
})

/** The owner's half: what the trip is called, where it goes, when, and the most the group will spend. */
function DetailsForm({ trip, isOwner }: { trip: Trip; isOwner: boolean }) {
  const update = useUpdateTrip(trip.id)
  const [cap, setCap] = React.useState<number | null>(trip.budgetCapCents)
  const [capError, setCapError] = React.useState<string | null>(null)

  const initial = {
    name: trip.name,
    destination: trip.destination,
    startDate: trip.startDate ? isoToDay(trip.startDate) : '',
    endDate: trip.endDate ? isoToDay(trip.endDate) : '',
  }
  const form = useForm<z.infer<typeof detailsSchema>>({
    resolver: zodResolver(detailsSchema),
    defaultValues: initial,
  })

  const submit = form.handleSubmit(async (values) => {
    if (cap !== null && (cap < 0 || cap > MONEY_MAX_CENTS)) {
      setCapError(cap < 0 ? 'The budget cannot be negative.' : 'That is too much.')
      return
    }
    const patch = detailsPatch(trip, { ...values, budgetCapCents: cap })
    if (isEmptyPatch(patch)) {
      toast.message('Nothing to save. Nothing has changed.')
      return
    }
    try {
      const saved = await update.mutateAsync(patch)
      toast.success('Trip details saved.')
      form.reset({
        name: saved.name,
        destination: saved.destination,
        startDate: saved.startDate ? isoToDay(saved.startDate) : '',
        endDate: saved.endDate ? isoToDay(saved.endDate) : '',
      })
      setCap(saved.budgetCapCents)
    } catch (error) {
      toast.error(messageFor(error, 'Could not save the trip details.'))
    }
  })

  return (
    <form onSubmit={submit} className="plate flex flex-col gap-5 p-5" noValidate>
      <div>
        <span className="placard text-xs">The trip</span>
        {!isOwner ? (
          <p className="mt-1 text-xs text-muted-foreground">
            Only the trip owner can change these.
          </p>
        ) : null}
      </div>

      <fieldset disabled={!isOwner} className="flex flex-col gap-5">
        <Field label="Trip name" error={form.formState.errors.name?.message} required>
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              maxLength={NAME_MAX}
              aria-describedby={describedBy}
              aria-invalid={invalid}
              {...form.register('name')}
            />
          )}
        </Field>
        <Field label="Destination" error={form.formState.errors.destination?.message}>
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              maxLength={DESTINATION_MAX}
              aria-describedby={describedBy}
              aria-invalid={invalid}
              {...form.register('destination')}
            />
          )}
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Starts" error={form.formState.errors.startDate?.message}>
            {({ id }) => <Input id={id} type="date" {...form.register('startDate')} />}
          </Field>
          <Field label="Ends" error={form.formState.errors.endDate?.message}>
            {({ id, describedBy, invalid }) => (
              <Input
                id={id}
                type="date"
                aria-describedby={describedBy}
                aria-invalid={invalid}
                {...form.register('endDate')}
              />
            )}
          </Field>
        </div>
        <Field
          label="Budget cap"
          error={capError ?? undefined}
          hint="The most the group wants to spend in total. Leave it empty to measure against the cost estimate instead."
        >
          {({ id, describedBy, invalid }) => (
            <MoneyInput
              id={id}
              valueCents={cap}
              onChangeCents={(cents) => {
                setCapError(null)
                setCap(cents)
              }}
              aria-describedby={describedBy}
              aria-invalid={invalid}
            />
          )}
        </Field>
      </fieldset>

      {isOwner ? (
        <Button type="submit" disabled={update.isPending} className="min-h-11 self-start">
          {update.isPending ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : null}
          Save trip details
        </Button>
      ) : null}
    </form>
  )
}

/** Every member's half: the allowance the estimate assumes, and the numbers the fuel form starts from. */
function SharedForm({ trip }: { trip: Trip }) {
  const update = useUpdateTrip(trip.id)
  const [allowance, setAllowance] = React.useState<number | null>(trip.allowanceCents)
  const [allowanceError, setAllowanceError] = React.useState<string | null>(null)

  const form = useForm<z.input<typeof sharedSchema>>({
    resolver: zodResolver(sharedSchema),
    defaultValues: {
      defaultEfficiency: trip.defaultEfficiency,
      defaultPricePerLitreCents: trip.defaultPricePerLitreCents,
    },
  })

  const submit = form.handleSubmit(async (values) => {
    const parsed = sharedSchema.parse(values)
    if (allowance === null) {
      setAllowanceError('Enter an allowance, or 0 for none.')
      return
    }
    if (allowance < 0 || allowance > MONEY_MAX_CENTS) {
      setAllowanceError(allowance < 0 ? 'The allowance cannot be negative.' : 'That is too much.')
      return
    }
    const patch = sharedPatch(trip, {
      allowanceCents: allowance,
      defaultEfficiency: parsed.defaultEfficiency,
      defaultPricePerLitreCents: parsed.defaultPricePerLitreCents,
    })
    if (isEmptyPatch(patch)) {
      toast.message('Nothing to save. Nothing has changed.')
      return
    }
    try {
      const saved = await update.mutateAsync(patch)
      toast.success('Money and fuel settings saved.')
      form.reset({
        defaultEfficiency: saved.defaultEfficiency,
        defaultPricePerLitreCents: saved.defaultPricePerLitreCents,
      })
      setAllowance(saved.allowanceCents)
    } catch (error) {
      toast.error(messageFor(error, 'Could not save those settings.'))
    }
  })

  return (
    <form onSubmit={submit} className="plate flex flex-col gap-5 p-5" noValidate>
      <div>
        <span className="placard text-xs">Money and fuel</span>
        <p className="mt-1 text-xs text-muted-foreground">Anyone on the trip can change these.</p>
      </div>

      <Field
        label="Allowance each"
        error={allowanceError ?? undefined}
        hint={`What each person is assumed to spend on top of bookings and fuel, in the cost estimate. Now ${formatMoney(trip.allowanceCents)}.`}
      >
        {({ id, describedBy, invalid }) => (
          <MoneyInput
            id={id}
            valueCents={allowance}
            onChangeCents={(cents) => {
              setAllowanceError(null)
              setAllowance(cents)
            }}
            aria-describedby={describedBy}
            aria-invalid={invalid}
          />
        )}
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field
          label="Usual L/100km"
          error={form.formState.errors.defaultEfficiency?.message}
        >
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              inputMode="decimal"
              className="font-mono"
              aria-describedby={describedBy}
              aria-invalid={invalid}
              {...form.register('defaultEfficiency')}
            />
          )}
        </Field>
        <Field
          label="Usual cents/L"
          error={form.formState.errors.defaultPricePerLitreCents?.message}
        >
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              inputMode="numeric"
              className="font-mono"
              aria-describedby={describedBy}
              aria-invalid={invalid}
              {...form.register('defaultPricePerLitreCents')}
            />
          )}
        </Field>
      </div>
      <p className="-mt-3 text-xs text-muted-foreground">
        The fuel form starts from these. Adding a leg updates them to what it used.
      </p>

      <Button type="submit" disabled={update.isPending} className="min-h-11 self-start">
        {update.isPending ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : null}
        Save money and fuel
      </Button>
    </form>
  )
}

export function SettingsPage() {
  const { tripId = '' } = useParams<{ tripId: string }>()
  const userId = useCurrentUserId()
  const trip = useTrip(tripId)
  const members = useMembers(tripId)

  if (trip.isPending || members.isPending) return <ListSkeleton rows={3} />

  const queries = [trip, members]
  if (anyFailed(queries) || !trip.data) return <ScreenError queries={queries} />

  const isOwner = (members.data ?? []).some((m) => m.userId === userId && m.role === 'owner')

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Trip settings"
        subtitle="The name and dates, what the group is willing to spend, and what the fuel form starts from."
      />
      {/* Keyed on what is saved, so a change made by somebody else fills the form in again. */}
      <DetailsForm
        key={`d-${trip.data.name}-${trip.data.destination}-${trip.data.startDate}-${trip.data.endDate}-${trip.data.budgetCapCents}`}
        trip={trip.data}
        isOwner={isOwner}
      />
      <SharedForm
        key={`s-${trip.data.allowanceCents}-${trip.data.defaultEfficiency}-${trip.data.defaultPricePerLitreCents}`}
        trip={trip.data}
      />
    </div>
  )
}
