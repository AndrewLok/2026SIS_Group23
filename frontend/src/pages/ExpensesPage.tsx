import * as React from 'react'
import { Link, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Fuel, Loader2, Plus, Receipt, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
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
import { Progress } from '@/components/ui/progress'
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
import { CategoryBadge, PageHeader, Placard } from '@/components/common/chrome'
import { EmptyState, ListSkeleton, ScreenError, anyFailed } from '@/components/common/state'
import {
  useBookings,
  useCreateExpense,
  useExpenses,
  useFuelLegs,
  useMembers,
  useRemoveExpense,
  useTrip,
  useUpdateTrip,
} from '@/hooks/queries'
import { useCurrentUserId } from '@/hooks/useSession'
import {
  computeBalances,
  settle,
  shareForMember,
  totalSpent,
  transfersInvolving,
} from '@/lib/balances'
import { estimateTrip, spendProgress } from '@/lib/estimate'
import { dayKey, formatDay, isUnderway } from '@/lib/dates'
import { formatMoney, splitEvenly } from '@/lib/money'
import type { Expense, ExpenseCategory, Profile } from '@/types'

const categories: ExpenseCategory[] = ['food', 'transport', 'tickets', 'stay', 'other']

const expenseSchema = z.object({
  description: z.string().min(1, 'Say what the money went on.'),
  category: z.enum(['food', 'transport', 'tickets', 'stay', 'other']),
  paidBy: z.string().min(1),
  spentAt: z.string().min(1, 'Pick a date.'),
})

function AddExpenseDrawer({
  tripId,
  members,
  userId,
}: {
  tripId: string
  members: Profile[]
  userId: string
}) {
  const [open, setOpen] = React.useState(false)
  const [amountCents, setAmountCents] = React.useState<number | null>(null)
  const [amountError, setAmountError] = React.useState<string | null>(null)
  const create = useCreateExpense(tripId)

  const form = useForm<z.infer<typeof expenseSchema>>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      description: '',
      category: 'food',
      paidBy: userId,
      spentAt: new Date().toISOString().slice(0, 10),
    },
  })

  // The live per-head figure, so nobody has to do the division in their head.
  const perHead = amountCents === null ? null : (splitEvenly(amountCents, members.length)[0] ?? 0)

  const submit = form.handleSubmit(async (values) => {
    if (amountCents === null || amountCents <= 0) {
      setAmountError('Enter an amount above zero.')
      return
    }
    try {
      await create.mutateAsync({
        description: values.description,
        amountCents,
        paidBy: values.paidBy,
        spentAt: new Date(values.spentAt).toISOString(),
        category: values.category,
      })
      toast.success('Expense added. Balances updated.')
      setOpen(false)
      form.reset()
      setAmountCents(null)
      setAmountError(null)
    } catch {
      toast.error('Could not add that expense.')
    }
  })

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button className="min-h-11">
          <Plus size={16} aria-hidden="true" />
          Add expense
        </Button>
      </DrawerTrigger>
      <DrawerContent>
        <div className="mx-auto w-full max-w-md">
          <DrawerHeader>
            <DrawerTitle>Add an expense</DrawerTitle>
            <DrawerDescription>
              Splits evenly across all {members.length} members. Fuel legs are the one exception.
            </DrawerDescription>
          </DrawerHeader>
          <form onSubmit={submit} className="flex flex-col gap-5 px-4" noValidate>
            <Field label="What was it" error={form.formState.errors.description?.message} required>
              {({ id, describedBy, invalid }) => (
                <Input
                  id={id}
                  placeholder="Groceries at Colac"
                  aria-describedby={describedBy}
                  aria-invalid={invalid}
                  {...form.register('description')}
                />
              )}
            </Field>

            <Field label="Amount" error={amountError ?? undefined} required>
              {({ id, describedBy, invalid }) => (
                <MoneyInput
                  id={id}
                  valueCents={amountCents}
                  onChangeCents={(c) => {
                    setAmountCents(c)
                    setAmountError(null)
                  }}
                  aria-describedby={describedBy}
                  aria-invalid={invalid}
                />
              )}
            </Field>

            {perHead !== null && perHead > 0 ? (
              <p className="tabular -mt-2 text-sm text-radium">
                {formatMoney(perHead)} each across {members.length} members
              </p>
            ) : null}

            <div className="grid grid-cols-2 gap-4">
              <Field label="Category">
                {({ id }) => (
                  <Select
                    value={form.watch('category')}
                    onValueChange={(v) => form.setValue('category', v as ExpenseCategory)}
                  >
                    <SelectTrigger id={id}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </Field>
              <Field label="Date" error={form.formState.errors.spentAt?.message}>
                {({ id }) => <Input id={id} type="date" {...form.register('spentAt')} />}
              </Field>
            </div>

            <Field label="Who paid">
              {({ id }) => (
                <Select
                  value={form.watch('paidBy')}
                  onValueChange={(v) => form.setValue('paidBy', v)}
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

            <DrawerFooter className="px-0">
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? (
                  <Loader2 size={15} className="animate-spin" aria-hidden="true" />
                ) : null}
                Add expense
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                Even splits only. Voyager does not move any money.
              </p>
            </DrawerFooter>
          </form>
        </div>
      </DrawerContent>
    </Drawer>
  )
}

function ExpenseRow({
  expense,
  profiles,
  userId,
  memberIds,
  fuelLegs,
  tripId,
  onDelete,
}: {
  expense: Expense
  profiles: Map<string, Profile>
  userId: string
  memberIds: string[]
  fuelLegs: Parameters<typeof shareForMember>[3]
  tripId: string
  onDelete: (id: string) => void
}) {
  const payer = profiles.get(expense.paidBy)
  const myShare = shareForMember(expense, userId, memberIds, fuelLegs)
  const fromFuel = expense.source === 'fuel'

  return (
    <li className="plate flex items-start gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-medium">{expense.description}</p>
          {fromFuel ? (
            <Placard>
              <Fuel size={10} className="mr-1" aria-hidden="true" />
              fuel
            </Placard>
          ) : (
            <CategoryBadge category={expense.category} kind="expense" />
          )}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {payer?.displayName ?? 'Someone'}
          {expense.paidBy === userId ? ' (you)' : ''} paid
          {myShare > 0 ? ` · your share ${formatMoney(myShare)}` : ' · not your split'}
        </p>
        {fromFuel ? (
          <Link
            to={`/trips/${tripId}/fuel`}
            className="mt-1 inline-block text-xs text-radium underline underline-offset-4"
          >
            Edit the fuel leg
          </Link>
        ) : null}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <span className="tabular text-sm">{formatMoney(expense.amountCents)}</span>
        {!fromFuel ? (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" className="size-11 text-placard">
                <Trash2 size={15} aria-hidden="true" />
                <span className="sr-only">Delete {expense.description}</span>
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this expense?</AlertDialogTitle>
                <AlertDialogDescription>
                  {expense.description}, {formatMoney(expense.amountCents)}. Deleting it rewrites
                  every member's balance, including what other people owe each other.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep it</AlertDialogCancel>
                <AlertDialogAction onClick={() => onDelete(expense.id)}>
                  Delete expense
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : null}
      </div>
    </li>
  )
}

export function ExpensesPage() {
  const { tripId = '' } = useParams<{ tripId: string }>()
  const userId = useCurrentUserId()

  const trip = useTrip(tripId)
  const members = useMembers(tripId)
  const expenses = useExpenses(tripId)
  const fuelLegs = useFuelLegs(tripId)
  const bookings = useBookings(tripId)
  const removeExpense = useRemoveExpense(tripId)
  const updateTrip = useUpdateTrip(tripId)

  const profiles = React.useMemo(
    () => new Map((members.data ?? []).map((m) => [m.userId, m.profile])),
    [members.data],
  )

  if (trip.isPending || members.isPending || expenses.isPending || fuelLegs.isPending) {
    return <ListSkeleton rows={5} />
  }

  // A failed load must say so rather than falling through to an empty state.
  const queries = [trip, members, expenses, fuelLegs, bookings]
  if (anyFailed(queries)) return <ScreenError queries={queries} />

  const memberIds = (members.data ?? []).map((m) => m.userId)
  const memberProfiles = (members.data ?? []).map((m) => m.profile)
  const allExpenses = expenses.data ?? []
  const allLegs = fuelLegs.data ?? []

  const balances = computeBalances(allExpenses, memberIds, allLegs)
  const net = balances.find((b) => b.userId === userId)?.netCents ?? 0
  const allTransfers = settle(balances)
  const privateDebts = trip.data?.privateDebts ?? true
  const transfers = privateDebts ? transfersInvolving(allTransfers, userId) : allTransfers

  const spent = totalSpent(allExpenses)
  const estimate = estimateTrip({
    bookings: bookings.data ?? [],
    fuelLegs: allLegs,
    allowanceCents: trip.data?.allowanceCents ?? 0,
    memberCount: memberIds.length,
  })
  const underway = isUnderway(trip.data?.startDate ?? null, trip.data?.endDate ?? null)

  const byDay = new Map<string, Expense[]>()
  for (const expense of allExpenses) {
    const key = dayKey(expense.spentAt)
    byDay.set(key, [...(byDay.get(key) ?? []), expense])
  }

  // Someone who has left the trip is still owed what they paid, so they can
  // appear here without being in the member list any more.
  const name = (id: string) =>
    profiles.get(id)?.displayName ?? 'someone who has left the trip'

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Money"
        subtitle={`${formatMoney(spent)} spent so far, across ${memberIds.length} members.`}
        action={
          <AddExpenseDrawer tripId={tripId} members={memberProfiles} userId={userId} />
        }
      />

      {/* Where you stand, in one sentence, before anything else. */}
      <section className="plate flex flex-col gap-2 px-5 py-4">
        <span className="placard text-xs">Your position</span>
        <p className="text-lg">
          {net === 0 ? (
            'You are square with everyone.'
          ) : net > 0 ? (
            <>
              You are owed{' '}
              <span className="instrument-value text-2xl text-radium">
                {formatMoney(Math.abs(net))}
              </span>
            </>
          ) : (
            <>
              You owe{' '}
              <span className="instrument-value text-2xl text-caution">
                {formatMoney(Math.abs(net))}
              </span>
            </>
          )}
        </p>
      </section>

      {underway ? (
        <section className="plate flex flex-col gap-3 px-5 py-4">
          <div className="flex items-baseline justify-between gap-4">
            <span className="placard text-xs">Spend against estimate</span>
            <span className="tabular text-sm">
              {formatMoney(spent)} of {formatMoney(estimate.totalCents)}
            </span>
          </div>
          <Progress value={spendProgress(spent, estimate.totalCents)} />
        </section>
      ) : null}

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="placard text-xs">Settle up</span>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <Switch
              checked={privateDebts}
              onCheckedChange={(checked) => updateTrip.mutate({ privateDebts: checked })}
            />
            Only show debts that involve me
          </label>
        </div>

        {transfers.length === 0 ? (
          <p className="plate px-4 py-4 text-sm text-muted-foreground">
            {allTransfers.length === 0
              ? 'Everyone is square. Nothing to settle.'
              : 'Nothing involving you. Others still have some settling to do.'}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {transfers.map((t) => {
              const youPay = t.from === userId
              const youGet = t.to === userId
              return (
                <li
                  key={`${t.from}-${t.to}`}
                  className="plate flex items-center justify-between gap-4 px-4 py-3"
                >
                  <span className="text-sm">
                    {youPay ? (
                      <>You owe {name(t.to)}</>
                    ) : youGet ? (
                      <>{name(t.from)} owes you</>
                    ) : (
                      <>
                        {name(t.from)} owes {name(t.to)}
                      </>
                    )}
                  </span>
                  <span
                    className="tabular text-sm"
                    style={{ color: youPay ? 'var(--caution)' : youGet ? 'var(--radium)' : undefined }}
                  >
                    {formatMoney(t.amountCents)}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
        <p className="text-xs text-muted-foreground">
          Voyager does not move money. Settle up between yourselves however you normally would.
        </p>
      </section>

      <section className="flex flex-col gap-4">
        <span className="placard text-xs">Expense log</span>
        {allExpenses.length === 0 ? (
          <EmptyState icon={Receipt} line="Nothing spent yet. Add the first one and the splits start working." />
        ) : (
          [...byDay.entries()].map(([key, dayExpenses]) => (
            <section key={key} className="flex flex-col gap-2">
              <div className="flex items-baseline gap-3">
                <h3 className="placard text-[0.625rem]">
                  {formatDay(dayExpenses[0]?.spentAt ?? key)}
                </h3>
                <span className="h-px flex-1 bg-bezel" aria-hidden="true" />
                <span className="tabular text-[0.625rem] text-placard">
                  {formatMoney(dayExpenses.reduce((s, e) => s + e.amountCents, 0))}
                </span>
              </div>
              <ul className="flex flex-col gap-2">
                {dayExpenses.map((expense) => (
                  <ExpenseRow
                    key={expense.id}
                    expense={expense}
                    profiles={profiles}
                    userId={userId}
                    memberIds={memberIds}
                    fuelLegs={allLegs}
                    tripId={tripId}
                    onDelete={async (id) => {
                      await removeExpense.mutateAsync(id)
                      toast.success('Expense deleted. Balances updated.')
                    }}
                  />
                ))}
              </ul>
            </section>
          ))
        )}
      </section>
    </div>
  )
}
