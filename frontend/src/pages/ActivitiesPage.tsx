import * as React from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import {
  CalendarClock,
  CalendarPlus,
  Check,
  Compass,
  Lightbulb,
  Loader2,
  Plus,
  ThumbsDown,
  ThumbsUp,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Field } from '@/components/common/Field'
import { CategoryBadge, PageHeader, Placard } from '@/components/common/chrome'
import { EmptyState, ListSkeleton, ScreenError, anyFailed } from '@/components/common/state'
import { MemberAvatar } from '@/components/common/people'
import { AddActivityDrawer } from '@/components/activities/AddActivityDrawer'
import {
  useCastVote,
  useIdeas,
  useMembers,
  useRemoveIdea,
  useSetAttending,
  useUpdateIdea,
  useVotes,
} from '@/hooks/queries'
import { useCurrentUserId } from '@/hooks/useSession'
import { agreeThreshold, isOnThePlan, needsADate, tally } from '@/lib/voting'
import { blankPreset, endOf, overlaps } from '@/lib/schedule'
import { dayKey, formatDay, formatDayTimeRange, toLocalInput } from '@/lib/dates'
import type { Idea, Profile, Vote } from '@/types'

const tabs = ['plan', 'voting', 'ruled-out'] as const
type Tab = (typeof tabs)[number]

const spanOf = (idea: Idea) =>
  idea.proposedStart
    ? { start: Date.parse(idea.proposedStart), end: endOf(idea.proposedStart, idea.proposedEnd) }
    : null

/** Who is in on something, by name, so nobody has to hover an avatar to find out. */
function PeopleList({
  ids,
  profiles,
  label,
  empty,
}: {
  ids: string[]
  profiles: Map<string, Profile>
  label: string
  /** Shown when nobody is listed; omit to hide the row instead. */
  empty?: string
}) {
  if (ids.length === 0 && !empty) return null
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
      <span className="placard caption w-14 shrink-0">{label}</span>
      {ids.length === 0 ? (
        <span className="text-xs text-placard">{empty}</span>
      ) : (
        ids.map((id) => {
          const profile = profiles.get(id)
          if (!profile) return null
          return (
            <span
              key={id}
              className="inline-flex items-center gap-1.5 rounded-full border border-bezel py-0.5 pr-2 pl-0.5 text-xs"
            >
              <MemberAvatar profile={profile} size={18} />
              {profile.displayName.split(' ')[0]}
            </span>
          )
        })
      )}
    </div>
  )
}

/** Set or move when something happens, from right where it is listed. */
function DateButton({ idea, tripId }: { idea: Idea; tripId: string }) {
  const update = useUpdateIdea(tripId)
  const [open, setOpen] = React.useState(false)
  const [start, setStart] = React.useState('')
  const [end, setEnd] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)

  const onOpenChange = (next: boolean) => {
    if (next) {
      setStart(toLocalInput(idea.proposedStart))
      setEnd(toLocalInput(idea.proposedEnd))
      setError(null)
    }
    setOpen(next)
  }

  const save = async () => {
    if (!start) return setError('Pick a date and time.')
    if (end && end <= start) return setError('It has to finish after it starts.')
    try {
      await update.mutateAsync({
        ideaId: idea.id,
        patch: {
          proposedStart: new Date(start).toISOString(),
          proposedEnd: end ? new Date(end).toISOString() : null,
        },
      })
      toast.success(idea.proposedStart ? 'Date changed' : 'Date added')
      setOpen(false)
    } catch {
      toast.error('Could not save that date.')
    }
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="min-h-9">
          {idea.proposedStart ? (
            <CalendarClock size={14} aria-hidden="true" />
          ) : (
            <CalendarPlus size={14} aria-hidden="true" />
          )}
          {idea.proposedStart ? 'Change date' : 'Add date'}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="flex w-72 flex-col gap-3">
        <p className="text-sm font-medium">{idea.title}</p>
        <Field label="Starts" required error={error ?? undefined}>
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              type="datetime-local"
              value={start}
              aria-describedby={describedBy}
              aria-invalid={invalid}
              onChange={(e) => {
                setStart(e.target.value)
                setError(null)
              }}
            />
          )}
        </Field>
        <Field label="Finishes" hint="Optional. Without it, it shows as an hour.">
          {({ id, describedBy }) => (
            <Input
              id={id}
              type="datetime-local"
              value={end}
              min={start || undefined}
              aria-describedby={describedBy}
              onChange={(e) => {
                setEnd(e.target.value)
                setError(null)
              }}
            />
          )}
        </Field>
        <Button onClick={save} disabled={update.isPending}>
          {update.isPending ? (
            <Loader2 size={15} className="animate-spin" aria-hidden="true" />
          ) : null}
          Save date
        </Button>
      </PopoverContent>
    </Popover>
  )
}

function DeleteButton({ idea, tripId }: { idea: Idea; tripId: string }) {
  const remove = useRemoveIdea(tripId)
  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-11 text-placard"
      onClick={async () => {
        await remove.mutateAsync(idea.id)
        toast.success('Activity deleted')
      }}
    >
      <Trash2 size={14} aria-hidden="true" />
      <span className="sr-only">Delete {idea.title}</span>
    </Button>
  )
}

function ActivityHeading({ idea }: { idea: Idea }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h3 className="text-sm font-medium">{idea.title}</h3>
        {idea.description ? (
          <p className="mt-1 text-sm text-muted-foreground">{idea.description}</p>
        ) : null}
      </div>
      <CategoryBadge category={idea.category} kind="idea" className="shrink-0" />
    </div>
  )
}

/** When it is, and the button to set or move it. */
function WhenRow({ idea, tripId, children }: { idea: Idea; tripId: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
      {idea.proposedStart ? (
        <span className="tabular text-foreground">
          {formatDayTimeRange(idea.proposedStart, idea.proposedEnd)}
        </span>
      ) : (
        <span className="text-placard">No date yet</span>
      )}
      <DateButton idea={idea} tripId={tripId} />
      {children}
    </div>
  )
}

/** Something going ahead: who is in, and a way to say you are in or out. */
function PlanRow({
  idea,
  profiles,
  userId,
  tripId,
}: {
  idea: Idea
  profiles: Map<string, Profile>
  userId: string
  tripId: string
}) {
  const setAttending = useSetAttending(tripId, userId)
  const creator = profiles.get(idea.proposedBy)
  const going = idea.attendeeIds.includes(userId)
  const count = idea.attendeeIds.length

  const toggle = () =>
    setAttending.mutate(
      { ideaId: idea.id, attending: !going },
      { onError: () => toast.error('Could not update that. Try again.') },
    )

  return (
    <li id={`activity-${idea.id}`} className="plate flex scroll-mt-24 flex-col gap-3 p-4">
      <ActivityHeading idea={idea} />

      <WhenRow idea={idea} tripId={tripId}>
        <span>
          {idea.status === 'agreed' ? 'Voted in' : 'Added'} by{' '}
          {idea.proposedBy === userId ? 'you' : (creator?.displayName ?? 'a member')}
        </span>
      </WhenRow>

      <PeopleList ids={idea.attendeeIds} profiles={profiles} label="Going" empty="Nobody yet" />

      <div className="flex items-center justify-between gap-3 border-t border-bezel pt-3">
        <span className="tabular text-xs text-muted-foreground">
          {count === 0
            ? 'Nobody going yet'
            : going
              ? count === 1
                ? 'Just you so far'
                : `You and ${count - 1} more`
              : `${count} going`}
        </span>
        <div className="flex items-center gap-2">
          {idea.proposedBy === userId ? <DeleteButton idea={idea} tripId={tripId} /> : null}
          {going ? (
            <Button variant="outline" size="sm" className="min-h-11" onClick={toggle}>
              I'm out
            </Button>
          ) : (
            <Button size="sm" className="min-h-11" onClick={toggle}>
              <Check size={14} aria-hidden="true" />
              I'm in
            </Button>
          )}
        </div>
      </div>
    </li>
  )
}

type VoteProps = {
  votes: Vote[]
  profiles: Map<string, Profile>
  memberCount: number
  userId: string
  tripId: string
}

/** One option still being decided, or ruled out: who is in, who is out, and the vote. */
function VoteCard({
  idea,
  votes,
  profiles,
  memberCount,
  userId,
  tripId,
  clashesWith = [],
}: VoteProps & { idea: Idea; clashesWith?: Idea[] }) {
  const cast = useCastVote(tripId, userId)
  const t = tally(votes, idea.id, userId)
  const threshold = agreeThreshold(memberCount)
  const proposer = profiles.get(idea.proposedBy)

  const vote = (value: 1 | -1) => {
    // Tapping your own vote again clears it.
    cast.mutate({ ideaId: idea.id, value: t.own === value ? null : value })
  }

  return (
    <li
      id={`activity-${idea.id}`}
      className="plate flex min-w-0 scroll-mt-24 list-none flex-col gap-3 p-4"
    >
      <ActivityHeading idea={idea} />

      <WhenRow idea={idea} tripId={tripId}>
        <span>Proposed by {idea.proposedBy === userId ? 'you' : (proposer?.displayName ?? 'a member')}</span>
      </WhenRow>

      {clashesWith.length > 0 ? (
        <Placard className="self-start border-caution/40 text-caution">
          Same time as {clashesWith.map((c) => c.title).join(', ')}
        </Placard>
      ) : null}

      <div className="flex flex-col gap-2">
        <PeopleList ids={t.agreeIds} profiles={profiles} label="In" empty="Nobody yet" />
        <PeopleList ids={t.disagreeIds} profiles={profiles} label="Out" />
      </div>

      <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-bezel pt-3">
        <span className="tabular text-xs text-muted-foreground">
          {t.agree} of {threshold} needed
        </span>
        <div className="flex items-center gap-2">
          {idea.proposedBy === userId ? <DeleteButton idea={idea} tripId={tripId} /> : null}
          <Button
            variant={t.own === -1 ? 'default' : 'outline'}
            size="sm"
            onClick={() => vote(-1)}
            aria-pressed={t.own === -1}
            className={`min-h-11 min-w-14 ${t.own === -1 ? 'bg-caution text-panel hover:bg-caution/90' : ''}`}
          >
            <ThumbsDown size={14} aria-hidden="true" />
            {t.disagree}
            <span className="sr-only">against</span>
          </Button>
          <Button
            variant={t.own === 1 ? 'default' : 'outline'}
            size="sm"
            className="min-h-11 min-w-14"
            onClick={() => vote(1)}
            aria-pressed={t.own === 1}
          >
            <ThumbsUp size={14} aria-hidden="true" />
            {t.agree}
            <span className="sr-only">for</span>
          </Button>
        </div>
      </div>
    </li>
  )
}

/**
 * For one day with several options, each member against the option they are in
 * for, so "who is doing what" is a read rather than a cross-reference.
 */
function WhoIsDoingWhat({
  options,
  votes,
  members,
}: {
  options: Idea[]
  votes: Vote[]
  members: Profile[]
}) {
  return (
    <ul className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
      {members.map((member) => {
        const inFor = options.filter((o) =>
          votes.some((v) => v.ideaId === o.id && v.userId === member.id && v.value === 1),
        )
        return (
          <li key={member.id} className="flex min-w-0 items-center gap-2 text-xs">
            <MemberAvatar profile={member} size={18} />
            <span className="w-16 shrink-0 truncate">{member.displayName.split(' ')[0]}</span>
            <span
              className={`truncate ${inFor.length === 0 ? 'text-placard' : 'text-foreground'}`}
            >
              {inFor.length === 0 ? 'Not in for any yet' : inFor.map((o) => o.title).join(' / ')}
            </span>
          </li>
        )
      })}
    </ul>
  )
}

/**
 * Open votes, grouped by day. Options on the same day sit side by side, so it
 * is plain that two people want one thing and three want another.
 */
function VotingBoard({
  ideas,
  members,
  ...voteProps
}: VoteProps & { ideas: Idea[]; members: Profile[] }) {
  const byDay = new Map<string, Idea[]>()
  const undated: Idea[] = []
  for (const idea of [...ideas].sort((a, b) =>
    (a.proposedStart ?? '').localeCompare(b.proposedStart ?? ''),
  )) {
    if (!idea.proposedStart) undated.push(idea)
    else {
      const key = dayKey(idea.proposedStart)
      byDay.set(key, [...(byDay.get(key) ?? []), idea])
    }
  }

  const clashesFor = (idea: Idea, sameDay: Idea[]) => {
    const span = spanOf(idea)
    if (!span) return []
    return sameDay.filter((other) => {
      const o = spanOf(other)
      return other.id !== idea.id && o !== null && overlaps(span, o)
    })
  }

  return (
    <div className="flex flex-col gap-8">
      {[...byDay.entries()].map(([key, options]) => (
        <section key={key} className="flex flex-col gap-3">
          <div className="flex items-baseline gap-3">
            <h2 className="placard text-xs">{formatDay(options[0]!.proposedStart!)}</h2>
            <span className="text-xs text-muted-foreground">
              {options.length === 1 ? '1 option' : `${options.length} options`}
            </span>
            <span className="h-px flex-1 bg-bezel" aria-hidden="true" />
          </div>
          <ul
            className="relative grid gap-3 overflow-x-auto pb-1"
            style={{ gridAutoFlow: 'column', gridAutoColumns: 'minmax(17rem, 1fr)' }}
          >
            {options.map((idea) => (
              <VoteCard
                key={idea.id}
                idea={idea}
                clashesWith={clashesFor(idea, options)}
                {...voteProps}
              />
            ))}
          </ul>
          {options.length > 1 ? (
            <div className="rounded-md border border-bezel p-3">
              <p className="placard caption mb-2">Who is doing what</p>
              <WhoIsDoingWhat options={options} votes={voteProps.votes} members={members} />
            </div>
          ) : null}
        </section>
      ))}

      {undated.length > 0 ? (
        <section className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <Placard className="border-caution/40 text-caution">
              <CalendarPlus size={12} className="mr-1.5" aria-hidden="true" />
              No date yet
            </Placard>
            <span className="h-px flex-1 bg-bezel" aria-hidden="true" />
          </div>
          <ul className="grid gap-3 sm:grid-cols-2">
            {undated.map((idea) => (
              <VoteCard key={idea.id} idea={idea} {...voteProps} />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}

const isTab = (value: string | null): value is Tab => tabs.includes(value as Tab)

export function ActivitiesPage() {
  const { tripId = '' } = useParams<{ tripId: string }>()
  const [params, setParams] = useSearchParams()
  const userId = useCurrentUserId()
  const ideas = useIdeas(tripId)
  const votes = useVotes(tripId)
  const members = useMembers(tripId)
  const [drawerOpen, setDrawerOpen] = React.useState(false)

  const profiles = React.useMemo(
    () => new Map((members.data ?? []).map((m) => [m.userId, m.profile])),
    [members.data],
  )
  // Stable between renders, so the drawer does not reset while someone types.
  const memberProfiles = React.useMemo(
    () => (members.data ?? []).map((m) => m.profile),
    [members.data],
  )

  // The tab lives in the URL, so the overview can link straight to open votes.
  const requested = params.get('tab')
  const tab: Tab = isTab(requested) ? requested : 'plan'
  const setTab = (next: string) =>
    setParams(next === 'plan' ? {} : { tab: next }, { replace: true })

  // The calendar links to one activity with ?focus=<id>; bring its card into view.
  const focus = params.get('focus')
  const loaded = !ideas.isPending && !votes.isPending && !members.isPending
  React.useEffect(() => {
    if (!focus || !loaded) return
    document
      .getElementById(`activity-${focus}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [focus, loaded])

  if (!loaded) return <ListSkeleton rows={4} />

  // A failed load must say so rather than falling through to an empty state.
  const queries = [ideas, votes, members]
  if (anyFailed(queries)) return <ScreenError queries={queries} />

  const all = ideas.data ?? []
  const allVotes = votes.data ?? []
  const memberCount = memberProfiles.length

  // The plan reads in the order it will happen.
  const onThePlan = all
    .filter(isOnThePlan)
    .sort((a, b) => (a.proposedStart ?? '').localeCompare(b.proposedStart ?? ''))
  const undated = onThePlan.filter(needsADate)
  const dated = onThePlan.filter((i) => !needsADate(i))
  const open = all.filter((i) => i.status === 'voting')
  const rejected = all.filter((i) => i.status === 'rejected')

  const planProps = { profiles, userId, tripId }
  const voteProps = { votes: allVotes, profiles, memberCount, userId, tripId }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Activities"
        subtitle={`What the group is doing. Add something straight to the plan, or put it to a vote: ${agreeThreshold(memberCount)} of ${memberCount} votes carry it.`}
        action={
          <Button className="min-h-11" onClick={() => setDrawerOpen(true)}>
            <Plus size={16} aria-hidden="true" />
            Add activity
          </Button>
        }
      />

      <AddActivityDrawer
        tripId={tripId}
        members={memberProfiles}
        userId={userId}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        preset={blankPreset}
        onAdded={(mode) => {
          // Something put to a vote is found on the voting tab.
          if (mode === 'vote') setTab('voting')
        }}
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full">
          <TabsTrigger value="plan" className="flex-1">
            Plan {onThePlan.length > 0 ? `(${onThePlan.length})` : ''}
          </TabsTrigger>
          <TabsTrigger value="voting" className="flex-1">
            Voting {open.length > 0 ? `(${open.length})` : ''}
          </TabsTrigger>
          <TabsTrigger value="ruled-out" className="flex-1">
            Ruled out {rejected.length > 0 ? `(${rejected.length})` : ''}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="plan" className="mt-4 flex flex-col gap-5">
          {undated.length > 0 ? (
            <section className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <Placard className="border-caution/40 text-caution">
                  <CalendarPlus size={12} className="mr-1.5" aria-hidden="true" />
                  Needs a date
                </Placard>
                <span className="text-xs text-muted-foreground">
                  These cannot go on the calendar yet.
                </span>
              </div>
              <ul className="flex flex-col gap-3">
                {undated.map((idea) => (
                  <PlanRow key={idea.id} idea={idea} {...planProps} />
                ))}
              </ul>
            </section>
          ) : null}

          {dated.length > 0 ? (
            <ul className="flex flex-col gap-3">
              {dated.map((idea) => (
                <PlanRow key={idea.id} idea={idea} {...planProps} />
              ))}
            </ul>
          ) : null}

          {onThePlan.length === 0 ? (
            <EmptyState
              icon={Compass}
              line="Nothing planned yet. Add an activity, or put one to a vote."
            />
          ) : null}
        </TabsContent>

        <TabsContent value="voting" className="mt-4">
          {open.length === 0 ? (
            <EmptyState
              icon={Lightbulb}
              line="Nothing waiting on a vote. Put something to the group and they can call it."
            />
          ) : (
            <VotingBoard ideas={open} members={memberProfiles} {...voteProps} />
          )}
        </TabsContent>

        <TabsContent value="ruled-out" className="mt-4">
          {rejected.length === 0 ? (
            <EmptyState icon={Lightbulb} line="Nothing has been ruled out." />
          ) : (
            <ul className="flex flex-col gap-3">
              {rejected.map((idea) => (
                <VoteCard key={idea.id} idea={idea} {...voteProps} />
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
