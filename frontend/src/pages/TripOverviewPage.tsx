/*
 * The panel, seen from the driver's seat. Members open this more than any
 * other screen, so it answers the two questions before it offers anything
 * else: the road sign says what the group does next, and the balance needle
 * leans toward OWE or OWED before the figure is even read.
 *
 * Only two things on this screen are levels, so only two are dials: where you
 * stand with the group, and how much of the estimated budget is left in the
 * tank. Everything that is an alert rather than a level is a warning lamp, and
 * a lamp stays dark until something is genuinely waiting on you.
 */

import { Link, useParams } from 'react-router-dom'
import { differenceInCalendarDays, parseISO, startOfDay } from 'date-fns'
import { Fuel, Hand, MessageCircleMore, ReceiptText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ScreenError, anyFailed } from '@/components/common/state'
import { Dial } from '@/components/dashboard/Dial'
import { Lamp } from '@/components/dashboard/Lamp'
import { TripMeter } from '@/components/dashboard/TripMeter'
import { Windscreen } from '@/components/dashboard/Windscreen'
import {
  useBookings,
  useChannels,
  useExpenses,
  useFuelLegs,
  useIdeas,
  useMembers,
  useTrip,
  useVotes,
} from '@/hooks/queries'
import { useCurrentUserId } from '@/hooks/useSession'
import { api } from '@/services/client'
import { computeBalances, totalSpent } from '@/lib/balances'
import { nextUp, toCalendarItems } from '@/lib/calendar'
import { estimateTrip } from '@/lib/estimate'
import { daysUntil, formatDateRange, isUnderway } from '@/lib/dates'
import { formatMoney, formatMoneyCompact } from '@/lib/money'

/** The low-fuel lamp lights with this much of the estimate left, or less. */
const LOW_BUDGET = 0.15

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

function PanelSkeleton() {
  return (
    <div className="-mx-4 flex flex-col md:mx-0">
      <Skeleton className="h-54 rounded-t-[2rem] rounded-b-none md:h-76 md:rounded-t-[3rem]" />
      <div className="cowl -mt-6 grid grid-cols-2 gap-3 rounded-t-[1.75rem] rounded-b-xl px-3 pb-4 pt-5 md:-mt-10">
        <Skeleton className="aspect-square rounded-full" />
        <Skeleton className="aspect-square rounded-full" />
      </div>
    </div>
  )
}

/** What the trip meter counts: days to go, the day you are on, or days since. */
function tripMeterReading(startDate: string | null, endDate: string | null) {
  const countdown = daysUntil(startDate)
  if (countdown === null || !startDate) return { value: '---', label: 'No dates set' }
  const today = startOfDay(new Date())
  const pad = (n: number) => String(Math.min(999, n)).padStart(3, '0')

  if (isUnderway(startDate, endDate)) {
    const day = differenceInCalendarDays(today, startOfDay(parseISO(startDate))) + 1
    const total = endDate
      ? differenceInCalendarDays(startOfDay(parseISO(endDate)), startOfDay(parseISO(startDate))) + 1
      : null
    return { value: pad(day), label: total ? `Day ${day} of ${total}` : `Day ${day}` }
  }
  if (countdown >= 0) {
    return { value: pad(countdown), label: countdown === 1 ? 'Day to go' : 'Days to go' }
  }
  const since = endDate ? differenceInCalendarDays(today, startOfDay(parseISO(endDate))) : -countdown
  return { value: pad(since), label: since === 1 ? 'Day since home' : 'Days since home' }
}

export function TripOverviewPage() {
  const { tripId = '' } = useParams<{ tripId: string }>()
  const userId = useCurrentUserId()

  const trip = useTrip(tripId)
  const members = useMembers(tripId)
  const ideas = useIdeas(tripId)
  const bookings = useBookings(tripId)
  const fuelLegs = useFuelLegs(tripId)
  const expenses = useExpenses(tripId)
  const channels = useChannels(tripId)
  const votes = useVotes(tripId)

  const pending =
    trip.isPending ||
    members.isPending ||
    ideas.isPending ||
    bookings.isPending ||
    fuelLegs.isPending ||
    expenses.isPending

  if (pending) return <PanelSkeleton />

  // A failed load must say so rather than falling through to an empty state.
  const queries = [trip, members, ideas, bookings, fuelLegs, expenses, channels, votes]
  if (anyFailed(queries)) return <ScreenError queries={queries} />

  if (!trip.data || !members.data) {
    return <p className="text-sm text-muted-foreground">This trip could not be loaded.</p>
  }

  const memberIds = members.data.map((m) => m.userId)
  const profiles = members.data.map((m) => m.profile)
  const allIdeas = ideas.data ?? []
  const allBookings = bookings.data ?? []
  const allLegs = fuelLegs.data ?? []
  const allExpenses = expenses.data ?? []
  const allVotes = votes.data ?? []

  const next = nextUp(toCalendarItems(allIdeas, allBookings))

  /*
   * Balance is centre-zero on the same half-moon sweep as the tank: square
   * is straight up, owing leans left, owed leans right. The ends of the scale are the furthest anyone in the group
   * currently is from square, so the needle says where you sit among them.
   */
  const balances = computeBalances(allExpenses, memberIds, allLegs)
  const net = balances.find((b) => b.userId === userId)?.netCents ?? 0
  const reach = Math.max(100, ...balances.map((b) => Math.abs(b.netCents)))

  /*
   * The tank is the estimated trip cost; what has been spent drains it. Over
   * the estimate the needle rests on E and the reading says by how much.
   */
  const estimate = estimateTrip({
    bookings: allBookings,
    fuelLegs: allLegs,
    allowanceCents: trip.data.allowanceCents,
    memberCount: memberIds.length,
  })
  const tank = estimate.totalCents
  const left = tank - totalSpent(allExpenses)
  const lowBudget = tank > 0 && left <= tank * LOW_BUDGET

  // Lamps. Each lights from one condition that means "this is waiting on you".
  const awaitingMyVote = allIdeas.filter(
    (i) =>
      i.status === 'voting' && !allVotes.some((v) => v.ideaId === i.id && v.userId === userId),
  ).length
  const channelId = channels.data?.[0]?.id
  const unread = channelId ? api.chat.unreadCount(channelId, userId) : 0
  const unpriced = estimate.inputs.bookingsWithoutCost

  const meter = tripMeterReading(trip.data.startDate, trip.data.endDate)
  // A range takes an en dash; the shared formatter's spaced hyphen suits the other screens.
  const range = formatDateRange(trip.data.startDate, trip.data.endDate)?.replace(' - ', '–')
  const where = [trip.data.destination, range].filter(Boolean).join(' · ')

  const balanceWords =
    net === 0
      ? 'You are square with everyone'
      : net > 0
        ? `The group owes you ${formatMoney(net)}`
        : `You owe ${formatMoney(-net)}`

  const budgetWords =
    tank === 0
      ? 'No budget estimate yet'
      : left >= 0
        ? `${formatMoney(left)} of the ${formatMoney(tank)} estimate left`
        : `${formatMoney(-left)} over the ${formatMoney(tank)} estimate`

  return (
    <div className="flex flex-col gap-5">
      <h1 className="sr-only">{trip.data.name}</h1>

      <section aria-label="Dashboard" className="-mx-4 flex flex-col md:mx-0">
        <Windscreen tripId={tripId} profiles={profiles} next={next} />

        <div className="cowl relative -mt-6 rounded-b-xl rounded-t-[1.75rem] px-3 pb-2 pt-5 md:-mt-10 md:rounded-t-[3rem] md:px-10 md:pt-8">
          <div className="grid grid-cols-2 items-start gap-x-3 gap-y-4 md:grid-cols-[1fr_auto_1fr] md:gap-x-10">
            <Link
              to={`/trips/${tripId}/expenses`}
              aria-label={`${balanceWords}. Open money.`}
              className="group mx-auto flex w-full max-w-64 flex-col items-center gap-1.5 rounded-full"
            >
              <Dial
                name="Balance"
                value={net}
                min={-reach}
                max={reach}
                sweep={180}
                minors={3}
                marks={[
                  { at: -reach, label: 'OWE' },
                  { at: -reach / 2 },
                  { at: 0, label: '0' },
                  { at: reach / 2 },
                  { at: reach, label: 'OWED' },
                ]}
                reading={formatMoney(Math.abs(net))}
                tone={net < 0 ? 'caution' : net > 0 ? 'normal' : 'idle'}
              />
              <span className="placard text-xs leading-none group-hover:text-foreground">
                {net === 0 ? 'All square' : net > 0 ? 'Owed to you' : 'You owe'}
              </span>
            </Link>

            <div className="order-last col-span-2 flex flex-col items-center gap-1 md:order-0 md:col-span-1 md:self-center">
              <TripMeter value={meter.value} label={meter.label} />
              {where ? (
                <p className="text-center text-sm text-muted-foreground">{where}</p>
              ) : null}
            </div>

            <Link
              to={`/trips/${tripId}/expenses`}
              aria-label={`${budgetWords}. Open money.`}
              className="group mx-auto flex w-full max-w-64 flex-col items-center gap-1.5 rounded-full"
            >
              <Dial
                name="Budget"
                icon={<Fuel size={14} strokeWidth={2} />}
                value={Math.max(0, left)}
                min={0}
                max={Math.max(1, tank)}
                sweep={180}
                minors={3}
                marks={[
                  { at: 0, label: 'E' },
                  { at: tank / 4 },
                  { at: tank / 2, label: '½' },
                  { at: (tank * 3) / 4 },
                  { at: Math.max(1, tank), label: 'F' },
                ]}
                caution={tank > 0 ? { from: 0, to: tank * LOW_BUDGET } : undefined}
                reading={
                  tank === 0
                    ? '--'
                    : left >= 0
                      ? formatMoneyCompact(left)
                      : `-${formatMoneyCompact(-left)}`
                }
                tone={tank === 0 ? 'idle' : lowBudget ? 'caution' : 'normal'}
              />
              <span className="placard text-center text-xs leading-none group-hover:text-foreground">
                {tank === 0
                  ? 'No estimate yet'
                  : left >= 0
                    ? `Left of ${formatMoneyCompact(tank)}`
                    : `Over ${formatMoneyCompact(tank)}`}
              </span>
            </Link>
          </div>

          <nav
            aria-label="Warning lamps"
            className="mt-5 grid grid-cols-4 border-t border-white/6 pt-1 md:mt-7"
          >
            <Lamp
              to={`/trips/${tripId}/voting`}
              icon={Hand}
              label="Vote"
              count={awaitingMyVote}
              lit={awaitingMyVote > 0}
              description={
                awaitingMyVote > 0
                  ? `${plural(awaitingMyVote, 'idea is', 'ideas are')} waiting on your vote. Open voting.`
                  : 'No ideas waiting on your vote. Open voting.'
              }
            />
            <Lamp
              to={`/trips/${tripId}/chat`}
              icon={MessageCircleMore}
              label="Chat"
              count={unread}
              lit={unread > 0}
              description={
                unread > 0
                  ? `${plural(unread, 'unread message', 'unread messages')}. Open chat.`
                  : 'No unread messages. Open chat.'
              }
            />
            <Lamp
              to={`/trips/${tripId}/bookings`}
              icon={ReceiptText}
              label="Costs"
              count={unpriced}
              lit={unpriced > 0}
              description={
                unpriced > 0
                  ? `${plural(unpriced, 'booking has', 'bookings have')} no cost entered. Open bookings.`
                  : 'Every booking has a cost. Open bookings.'
              }
            />
            <Lamp
              to={`/trips/${tripId}/expenses`}
              icon={Fuel}
              label="Budget"
              lit={lowBudget}
              description={
                lowBudget
                  ? `Budget is running low: ${budgetWords}. Open money.`
                  : 'Budget is fine. Open money.'
              }
            />
          </nav>
        </div>
      </section>

      <Button asChild className="min-h-12 w-full text-base md:mx-auto md:w-72">
        <Link to={`/trips/${tripId}/expenses`}>Settle up</Link>
      </Button>

      <p className="max-w-[68ch] text-xs text-muted-foreground md:mx-auto md:text-center">
        The budget is an estimate, not a quote: {plural(estimate.inputs.bookingsCounted, 'priced booking', 'priced bookings')},{' '}
        {plural(estimate.inputs.fuelLegsCounted, 'fuel leg', 'fuel legs')} and a{' '}
        {formatMoney(estimate.inputs.allowancePerMemberCents)} allowance each. Everything on this
        trip is seeded demo data, not real activity.
      </p>
    </div>
  )
}
