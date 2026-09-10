/*
 * The panel. Members open this more than any other screen, so it answers the two
 * questions before it offers any navigation: what are we doing next, and what do
 * I owe. Everything below those two readings is a way of getting somewhere else.
 */

import { Link, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { AvatarStack } from '@/components/common/people'
import { Placard, ReadingStrip, SectionTile } from '@/components/common/chrome'
import { MoneyText } from '@/components/common/money'
import { ScreenError, anyFailed } from '@/components/common/state'
import {
  useBookings,
  useChannels,
  useExpenses,
  useFuelLegs,
  useIdeas,
  useMembers,
  useMessages,
  useTrip,
} from '@/hooks/queries'
import { useCurrentUserId } from '@/hooks/useSession'
import { api } from '@/services/client'
import { computeBalances, shareForMember, totalSpent } from '@/lib/balances'
import { nextUp, toCalendarItems } from '@/lib/calendar'
import { estimateTrip } from '@/lib/estimate'
import { daysUntil, formatDateRange, formatDayTime, formatTime, isUnderway } from '@/lib/dates'
import { formatMoney, formatMoneyCompact } from '@/lib/money'
import { agreeThreshold } from '@/lib/voting'
import { fuelShareFor, totalFuelCents } from '@/lib/fuel'
import type { Trend } from '@/components/common/Instrument'

function PanelSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-28 w-full rounded-[var(--radius)]" />
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-28 rounded-[var(--radius)]" />
        <Skeleton className="h-28 rounded-[var(--radius)]" />
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-52 rounded-[var(--radius)]" />
        ))}
      </div>
    </div>
  )
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
  const messages = useMessages(channels.data?.[0]?.id)

  const pending =
    trip.isPending ||
    members.isPending ||
    ideas.isPending ||
    bookings.isPending ||
    fuelLegs.isPending ||
    expenses.isPending

  if (pending) return <PanelSkeleton />

  // A failed load must say so rather than falling through to an empty state.
  const queries = [trip, members, ideas, bookings, fuelLegs, expenses, channels]
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

  const openIdeas = allIdeas.filter((i) => i.status === 'voting')
  const items = toCalendarItems(allIdeas, allBookings)
  const next = nextUp(items)

  const balances = computeBalances(allExpenses, memberIds, allLegs)
  const net = balances.find((b) => b.userId === userId)?.netCents ?? 0

  const channelId = channels.data?.[0]?.id
  const unread = channelId ? api.chat.unreadCount(channelId, userId) : 0
  const messageCount = messages.data?.length ?? 0

  /*
   * Every dial needs a real denominator or the needle means nothing. These are
   * the honest ones: group capacity, proposals still open, how much of the plan
   * has a time on it, your position against your own share, your fuel against
   * the trip's, and unread against everything said.
   */
  const spent = totalSpent(allExpenses)
  const perHeadShare = memberIds.length > 0 ? Math.round(spent / memberIds.length) : 0
  const agreedCount = allIdeas.filter((i) => i.status === 'agreed').length
  const schedulable = agreedCount + allBookings.length
  const fuelTotal = totalFuelCents(allLegs)
  const myFuel = fuelShareFor(allLegs, userId)

  /*
   * Trend on the balance is derived from the newest expense, so it says which
   * way the last movement pushed you. No trend is shown where none can be
   * derived; an arrow that means nothing is worse than no arrow.
   */
  const newest = allExpenses.reduce<(typeof allExpenses)[number] | null>(
    (latest, e) => (!latest || e.spentAt > latest.spentAt ? e : latest),
    null,
  )
  const balanceTrend: Trend | undefined = !newest
    ? undefined
    : newest.paidBy === userId
      ? 'up'
      : shareForMember(newest, userId, memberIds, allLegs) > 0
        ? 'down'
        : 'steady'
  const trendLabel = !newest
    ? undefined
    : newest.paidBy === userId
      ? `since you paid for ${newest.description.toLowerCase()}`
      : balanceTrend === 'down'
        ? `since ${newest.description.toLowerCase()}`
        : 'unchanged by the last expense'

  const countdown = daysUntil(trip.data.startDate)
  const underway = isUnderway(trip.data.startDate, trip.data.endDate)
  const range = formatDateRange(trip.data.startDate, trip.data.endDate)

  const estimate = estimateTrip({
    bookings: allBookings,
    fuelLegs: allLegs,
    allowanceCents: trip.data.allowanceCents,
    memberCount: memberIds.length,
  })

  const balanceDetail =
    net === 0 ? (
      'You are square with everyone.'
    ) : net > 0 ? (
      <>
        The group owes you <MoneyText cents={Math.abs(net)} colored />, split evenly across{' '}
        {memberIds.length} members.
      </>
    ) : (
      <>
        You owe <span className="tabular text-caution">{formatMoney(Math.abs(net))}</span>, split
        evenly across {memberIds.length} members.
      </>
    )

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4 border-b border-bezel pb-5">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold tracking-tight md:text-3xl">
            {trip.data.name}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {trip.data.destination || 'Destination not set'}
            {range ? ` · ${range}` : ' · dates not set'}
          </p>
          <Link
            to={`/trips/${tripId}/members`}
            className="mt-3 inline-flex rounded-full"
            aria-label={`${profiles.length} members`}
          >
            <AvatarStack profiles={profiles} size={30} />
          </Link>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <span
            className="instrument-value text-3xl leading-none"
            style={{
              color: countdown !== null && countdown >= 0 ? 'var(--radium)' : 'var(--placard)',
            }}
          >
            {countdown === null ? '--' : underway ? 'Now' : Math.abs(countdown)}
          </span>
          <Placard>
            {countdown === null
              ? 'no dates'
              : underway
                ? 'under way'
                : countdown >= 0
                  ? 'days to go'
                  : 'days ago'}
          </Placard>
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <ReadingStrip
          label="Next movement"
          value={next ? formatTime(next.startsAt) : '--:--'}
          detail={
            next ? (
              <>
                <span className="text-foreground">{next.title}</span>
                <br />
                {formatDayTime(next.startsAt)}
              </>
            ) : (
              <>
                Nothing agreed yet.{' '}
                <Link
                  to={`/trips/${tripId}/voting`}
                  className="text-radium underline underline-offset-4"
                >
                  Vote on some ideas
                </Link>
                .
              </>
            )
          }
        />
        <ReadingStrip
          label="Your balance"
          value={formatMoney(Math.abs(net))}
          tone={net < 0 ? 'caution' : 'normal'}
          trend={balanceTrend}
          trendLabel={trendLabel}
          detail={balanceDetail}
          action={
            <Button asChild size="sm" className="min-h-11 w-full sm:w-auto">
              <Link to={`/trips/${tripId}/expenses`}>Settle up</Link>
            </Button>
          }
        />
      </div>

      {/*
        Every dial reads against a real range, labelled on its own face. An
        invented ceiling makes the needle decorative, and a needle pegged at
        full sweep by construction says nothing at all.
      */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <SectionTile
          to={`/trips/${tripId}/members`}
          label="Members"
          display={String(memberIds.length)}
          value={memberIds.length}
          max={8}
          unit={`of 8 · ${agreeThreshold(memberIds.length)} to agree`}
        />
        <SectionTile
          to={`/trips/${tripId}/voting`}
          label="Voting"
          display={String(openIdeas.length)}
          value={openIdeas.length}
          max={Math.max(1, allIdeas.length)}
          unit={`open of ${allIdeas.length} proposed`}
          tone={openIdeas.length > 0 ? 'caution' : 'normal'}
        />
        <SectionTile
          to={`/trips/${tripId}/calendar`}
          label="Calendar"
          display={String(items.length)}
          value={items.length}
          max={Math.max(1, schedulable)}
          unit={`placed of ${schedulable} agreed`}
        />
        <SectionTile
          to={`/trips/${tripId}/expenses`}
          label="Expenses"
          display={formatMoneyCompact(Math.abs(net))}
          value={Math.abs(net)}
          max={Math.max(1, perHeadShare)}
          formatScale={formatMoneyCompact}
          unit={
            net < 0
              ? `you owe · share ${formatMoneyCompact(perHeadShare)}`
              : net > 0
                ? `owed to you · share ${formatMoneyCompact(perHeadShare)}`
                : 'square'
          }
          tone={net < 0 ? 'caution' : 'normal'}
        />
        <SectionTile
          to={`/trips/${tripId}/fuel`}
          label="Fuel"
          display={formatMoneyCompact(myFuel)}
          value={myFuel}
          max={Math.max(1, fuelTotal)}
          formatScale={formatMoneyCompact}
          unit={`your share of ${formatMoneyCompact(fuelTotal)}`}
        />
        <SectionTile
          to={`/trips/${tripId}/chat`}
          label="Chat"
          display={String(unread)}
          value={unread}
          max={Math.max(1, messageCount)}
          unit={`unread of ${messageCount}`}
          tone={unread > 0 ? 'caution' : 'normal'}
        />
      </div>

      <section className="plate fixings flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 px-5 py-4">
        <span className="placard text-xs">{underway ? 'Spent so far' : 'Estimated total'}</span>
        <span className="tabular text-sm">
          {underway
            ? `${formatMoney(spent)} of ${formatMoney(estimate.totalCents)}`
            : `${formatMoney(estimate.totalCents)}, about ${formatMoney(estimate.perMemberCents)} each`}
        </span>
        <p className="w-full text-xs text-muted-foreground">
          An estimate, not a quote. Counted from {estimate.inputs.bookingsCounted} priced bookings,{' '}
          {estimate.inputs.fuelLegsCounted} fuel legs and a{' '}
          {formatMoney(estimate.inputs.allowancePerMemberCents)} per-person allowance
          {estimate.inputs.bookingsWithoutCost > 0
            ? `. ${estimate.inputs.bookingsWithoutCost} booking${
                estimate.inputs.bookingsWithoutCost === 1 ? ' has' : 's have'
              } no cost entered.`
            : '.'}
        </p>
      </section>

      <p className="text-xs text-muted-foreground">
        Everything on this trip is seeded demo data, not real activity.
      </p>
    </div>
  )
}
