import * as React from 'react'
import { Link, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Fuel, Loader2, Pencil, Plus, Receipt, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { CategoryBadge, PageHeader, Placard, Segmented } from '@/components/common/chrome'
import { EmptyState, ListSkeleton, ScreenError, anyFailed } from '@/components/common/state'
import {
  useBookings,
  useCreateExpense,
  useExpenses,
  useFuelLegs,
  useMembers,
  useRemoveExpense,
  useTrip,
  useUpdateExpense,
  useUpdateTrip,
} from '@/hooks/queries'
import { useCurrentUserId } from '@/hooks/useSession'
import {
  computeBalances,
  settle,
  shareForMember,
  splitSummary,
  totalSpent,
  transfersInvolving,
} from '@/lib/balances'
import { budgetFor, estimateTrip, spendProgress } from '@/lib/estimate'
import { dayKey, dayToIso, formatDay, isUnderway, isoToDay, todayAsDay } from '@/lib/dates'
import { expensePatch, peopleFor, splitStateOf } from '@/lib/expenseEdit'
import { messageFor } from '@/lib/errors'
import { formatMoney, splitEvenly } from '@/lib/money'
import { cn } from '@/lib/utils'
import type { Expense, ExpenseCategory, ExpenseSplit, Profile } from '@/types'

const categories: ExpenseCategory[] = ['food', 'transport', 'tickets', 'stay', 'other']

// The same limit the server enforces (Limits.EXPENSE_DESCRIPTION).
const DESCRIPTION_MAX = 100

const expenseSchema = z.object({
  description: z
    .string()
    .min(1, 'Say what the money went on.')
    .max(DESCRIPTION_MAX, `Keep it to ${DESCRIPTION_MAX} characters or fewer.`),
  category: z.enum(['food', 'transport', 'tickets', 'stay', 'other']),
  paidBy: z.string().min(1),
  spentAt: z.string().min(1, 'Pick a date.'),
})

type SplitMode = 'equal' | 'exact'

/**
 * Adds an expense, or with `expense` given edits one. Editing sends only what changed, and leaves
 * the split alone unless it was touched: anyone who has left the trip but is still in it stays in it.
 */
function ExpenseDrawer({
  tripId,
  members,
  userId,
  expense,
  trigger,
}: {
  tripId: string
  members: Profile[]
  userId: string
  expense?: Expense
  trigger: React.ReactNode
}) {
  const editing = expense !== undefined
  const [open, setOpen] = React.useState(false)
  const memberIds = React.useMemo(() => members.map((m) => m.id), [members])
  // The people to show: the members, plus anyone who left but is still the payer or in the split.
  const people = React.useMemo(() => peopleFor(expense, members), [expense, members])
  const everyone = React.useMemo(() => people.map((m) => m.id), [people])
  const start = splitStateOf(expense?.split ?? null, memberIds)
  const [amountCents, setAmountCents] = React.useState<number | null>(expense?.amountCents ?? null)
  const [amountError, setAmountError] = React.useState<string | null>(null)
  const [mode, setMode] = React.useState<SplitMode>(start.mode)
  const [pickedIds, setPickedIds] = React.useState<string[]>(start.pickedIds)
  // Someone who leaves while the form is open is no longer on the list to tick, so they are dropped
  // here too, instead of being sent along and refused.
  const sharerIds = pickedIds.filter((id) => everyone.includes(id))
  const [owed, setOwed] = React.useState<Record<string, number | null>>(start.owed)
  const [splitError, setSplitError] = React.useState<string | null>(null)
  const create = useCreateExpense(tripId)
  const update = useUpdateExpense(tripId)

  const initialValues = (): z.infer<typeof expenseSchema> => ({
    description: expense?.description ?? '',
    category: expense?.category ?? 'food',
    paidBy: expense?.paidBy ?? userId,
    spentAt: expense ? isoToDay(expense.spentAt) : todayAsDay(),
  })

  const form = useForm<z.infer<typeof expenseSchema>>({
    resolver: zodResolver(expenseSchema),
    defaultValues: initialValues(),
  })

  const paidBy = form.watch('paidBy')
  const payerIsYou = paidBy === userId
  const payerName = payerIsYou
    ? 'you'
    : (people.find((m) => m.id === paidBy)?.displayName ?? 'the payer')
  const total = amountCents ?? 0

  /*
   * Live figures, so nobody has to do the division in their head. The equal
   * parts are worked out in the same sorted order the ledger uses, so the cent
   * shown beside each name is the cent that person is actually charged.
   */
  const sortedSharers = [...sharerIds].sort()
  const parts = splitEvenly(total, sortedSharers.length)
  const equalShare = new Map(sortedSharers.map((id, i) => [id, parts[i] ?? 0]))
  const owers = people.filter((m) => m.id !== paidBy)
  const owedTotal = owers.reduce((sum, m) => sum + (owed[m.id] ?? 0), 0)
  const owedToPayer =
    mode === 'equal' ? total - (equalShare.get(paidBy) ?? 0) : Math.min(owedTotal, total)
  const leftover = total - owedTotal

  const toggleSharer = (id: string) => {
    setSplitError(null)
    setPickedIds(() =>
      sharerIds.includes(id) ? sharerIds.filter((s) => s !== id) : [...sharerIds, id],
    )
  }

  /** Back to the starting point: empty when adding, the expense as it stands now when editing. */
  const startOver = () => {
    const fresh = splitStateOf(expense?.split ?? null, memberIds)
    form.reset(initialValues())
    setAmountCents(expense?.amountCents ?? null)
    setAmountError(null)
    setMode(fresh.mode)
    setPickedIds(fresh.pickedIds)
    setOwed(fresh.owed)
    setSplitError(null)
  }

  /** The split to send, or an error to show instead. */
  const buildSplit = (): ExpenseSplit | string => {
    if (mode === 'equal') {
      if (sharerIds.length === 0) return 'Pick at least one person to split it with.'
      return { kind: 'equal', userIds: sharerIds }
    }
    const amounts: Record<string, number> = {}
    for (const m of owers) {
      const cents = owed[m.id]
      if (cents === undefined || cents === null || cents === 0) continue
      if (cents < 0) return 'Amounts owed cannot be negative.'
      amounts[m.id] = cents
    }
    if (Object.keys(amounts).length === 0) return 'Enter what at least one person owes.'
    if (owedTotal > total) {
      return `That is ${formatMoney(owedTotal - total)} more than the total.`
    }
    return { kind: 'exact', amounts }
  }

  const submit = form.handleSubmit(async (values) => {
    if (amountCents === null || amountCents <= 0) {
      setAmountError('Enter an amount above zero.')
      return
    }
    const split = buildSplit()
    if (typeof split === 'string') {
      setSplitError(split)
      return
    }
    try {
      if (expense) {
        const patch = expensePatch(expense, values, amountCents, split, memberIds)
        if (Object.keys(patch).length === 0) {
          setOpen(false)
          return
        }
        await update.mutateAsync({ expenseId: expense.id, patch })
        toast.success('Expense changed. Balances updated.')
        setOpen(false)
        return
      }
      await create.mutateAsync({
        description: values.description,
        amountCents,
        paidBy: values.paidBy,
        spentAt: dayToIso(values.spentAt),
        category: values.category,
        split,
      })
      toast.success('Expense added. Balances updated.')
      setOpen(false)
      startOver()
    } catch (error) {
      toast.error(messageFor(error, editing ? 'Could not change that expense.' : 'Could not add that expense.'))
    }
  })

  return (
    <Drawer
      open={open}
      onOpenChange={(next) => {
        // Opening an edit starts from the expense as it is now, not as it was when the page loaded.
        if (next && editing) startOver()
        setOpen(next)
      }}
    >
      <DrawerTrigger asChild>{trigger}</DrawerTrigger>
      <DrawerContent>
        <div className="mx-auto w-full max-w-md overflow-y-auto">
          <DrawerHeader>
            <DrawerTitle>{editing ? 'Change this expense' : 'Add an expense'}</DrawerTitle>
            <DrawerDescription>
              {editing
                ? 'Balances are worked out again from what you save.'
                : 'Choose who owes for it. Split it equally, or say exactly what each person owes.'}
            </DrawerDescription>
          </DrawerHeader>
          <form onSubmit={submit} className="flex flex-col gap-5 px-4" noValidate>
            <Field label="What was it" error={form.formState.errors.description?.message} required>
              {({ id, describedBy, invalid }) => (
                <Input
                  id={id}
                  placeholder="Groceries at Colac"
                  maxLength={DESCRIPTION_MAX}
                  aria-describedby={describedBy}
                  aria-invalid={invalid}
                  {...form.register('description')}
                />
              )}
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Amount" error={amountError ?? undefined} required>
                {({ id, describedBy, invalid }) => (
                  <MoneyInput
                    id={id}
                    valueCents={amountCents}
                    onChangeCents={(c) => {
                      setAmountCents(c)
                      setAmountError(null)
                      setSplitError(null)
                    }}
                    aria-describedby={describedBy}
                    aria-invalid={invalid}
                  />
                )}
              </Field>
              <Field label="Who paid">
                {({ id }) => (
                  <Select
                    value={paidBy}
                    onValueChange={(v) => {
                      form.setValue('paidBy', v)
                      setSplitError(null)
                    }}
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
            </div>

            <fieldset className="flex flex-col gap-3">
              <legend className="placard caption mb-3">
                {mode === 'equal' ? 'Who is sharing it' : `Who owes ${payerName}`}
              </legend>
              <Segmented
                label="How to split it"
                value={mode}
                onChange={(next) => {
                  setMode(next)
                  setSplitError(null)
                }}
                options={[
                  { value: 'equal', label: 'Equally' },
                  { value: 'exact', label: 'Exact amounts' },
                ]}
              />

              {mode === 'equal' ? (
                <ul className="flex flex-col gap-1">
                  {people.map((m) => {
                    const ticked = sharerIds.includes(m.id)
                    return (
                      <li key={m.id} className="flex min-h-9 items-center gap-3">
                        <Checkbox
                          id={`sharer-${m.id}`}
                          checked={ticked}
                          onCheckedChange={() => toggleSharer(m.id)}
                        />
                        <Label htmlFor={`sharer-${m.id}`} className="flex-1 text-sm font-normal">
                          {m.displayName}
                          {m.id === userId ? ' (you)' : ''}
                        </Label>
                        {ticked && total > 0 ? (
                          <span className="tabular text-sm text-muted-foreground">
                            {formatMoney(equalShare.get(m.id) ?? 0)}
                          </span>
                        ) : null}
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <ul className="flex flex-col gap-2">
                  {owers.map((m) => (
                    <li key={m.id} className="flex items-center gap-3">
                      <Label htmlFor={`owed-${m.id}`} className="flex-1 text-sm font-normal">
                        {m.displayName}
                        {m.id === userId ? ' (you)' : ''}
                      </Label>
                      <MoneyInput
                        id={`owed-${m.id}`}
                        className="w-32"
                        valueCents={owed[m.id] ?? null}
                        onChangeCents={(c) => {
                          setOwed((current) => ({ ...current, [m.id]: c }))
                          setSplitError(null)
                        }}
                      />
                    </li>
                  ))}
                  <li className="flex items-center justify-between gap-3 border-t border-bezel pt-2 text-sm">
                    <span className="text-muted-foreground">
                      {payerIsYou ? 'Your share' : `${payerName}'s share`}, what is left
                    </span>
                    <span
                      className={cn('tabular', leftover < 0 ? 'text-caution' : 'text-foreground')}
                    >
                      {formatMoney(leftover)}
                    </span>
                  </li>
                </ul>
              )}

              {splitError ? (
                <p role="alert" className="text-xs text-caution">
                  {splitError}
                </p>
              ) : total > 0 && owedToPayer > 0 ? (
                <p className="tabular text-sm text-radium">
                  {payerIsYou ? 'You are' : `${payerName} is`} owed {formatMoney(owedToPayer)}
                </p>
              ) : null}
            </fieldset>

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

            <DrawerFooter className="px-0">
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? (
                  <Loader2 size={15} className="animate-spin" aria-hidden="true" />
                ) : null}
                {editing ? 'Save changes' : 'Add expense'}
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                Voyager does not move any money.
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
  canDelete,
  onDelete,
  edit,
}: {
  expense: Expense
  profiles: Map<string, Profile>
  userId: string
  memberIds: string[]
  fuelLegs: Parameters<typeof shareForMember>[3]
  tripId: string
  canDelete: boolean
  onDelete: (id: string) => void
  /** The edit drawer's trigger, shown to whoever may delete it too: the server allows the same people. */
  edit: React.ReactNode
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
          {` · ${splitSummary(expense, memberIds, fuelLegs)}`}
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
        {!fromFuel && canDelete ? edit : null}
        {!fromFuel && canDelete ? (
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
  // Live: an even split is shared by whoever is on the trip right now.
  const members = useMembers(tripId, true)
  const expenses = useExpenses(tripId)
  const fuelLegs = useFuelLegs(tripId)
  const bookings = useBookings(tripId)
  const removeExpense = useRemoveExpense(tripId)
  const updateTrip = useUpdateTrip(tripId)

  const profiles = React.useMemo(
    () => new Map((members.data ?? []).map((m) => [m.userId, m.profile])),
    [members.data],
  )
  const isOwner = (members.data ?? []).some((m) => m.userId === userId && m.role === 'owner')
  // The server decides, and says so if it is not allowed; this only keeps the button off the ones
  // that would be refused. Null means it is not known who added it (the mock store).
  const canDelete = (e: Expense): boolean =>
    isOwner || e.createdBy === null || e.createdBy === userId || e.paidBy === userId

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
  // The group's cap if it set one, otherwise the estimate.
  const budget = budgetFor(trip.data?.budgetCapCents ?? null, estimate.totalCents)
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
          <ExpenseDrawer
            tripId={tripId}
            members={memberProfiles}
            userId={userId}
            trigger={
              <Button className="min-h-11">
                <Plus size={16} aria-hidden="true" />
                Add expense
              </Button>
            }
          />
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

      {underway || budget.kind === 'cap' ? (
        <section className="plate flex flex-col gap-3 px-5 py-4">
          <div className="flex items-baseline justify-between gap-4">
            <span className="placard text-xs">
              {budget.kind === 'cap' ? 'Spend against budget cap' : 'Spend against estimate'}
            </span>
            <span className="tabular text-sm">
              {formatMoney(spent)} of {formatMoney(budget.totalCents)}
            </span>
          </div>
          <Progress value={spendProgress(spent, budget.totalCents)} />
          {budget.overCapBy > 0 ? (
            <p className="text-xs text-caution">
              The cost estimate is already {formatMoney(budget.overCapBy)} over the cap.
            </p>
          ) : null}
        </section>
      ) : null}

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="placard text-xs">Settle up</span>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <Switch
              checked={privateDebts}
              onCheckedChange={(checked) =>
                updateTrip.mutate(
                  { privateDebts: checked },
                  { onError: (error) => toast.error(messageFor(error, 'Could not change that setting.')) },
                )
              }
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
                <h3 className="placard text-xs">
                  {formatDay(dayExpenses[0]?.spentAt ?? key)}
                </h3>
                <span className="h-px flex-1 bg-bezel" aria-hidden="true" />
                <span className="tabular text-xs text-placard">
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
                    canDelete={canDelete(expense)}
                    edit={
                      <ExpenseDrawer
                        tripId={tripId}
                        members={memberProfiles}
                        userId={userId}
                        expense={expense}
                        trigger={
                          <Button variant="ghost" size="icon" className="size-11 text-placard">
                            <Pencil size={15} aria-hidden="true" />
                            <span className="sr-only">Edit {expense.description}</span>
                          </Button>
                        }
                      />
                    }
                    onDelete={async (id) => {
                      try {
                        await removeExpense.mutateAsync(id)
                        toast.success('Expense deleted. Balances updated.')
                      } catch (error) {
                        toast.error(messageFor(error, 'Could not delete that expense.'))
                      }
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
