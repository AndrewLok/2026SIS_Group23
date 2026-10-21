import * as React from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
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
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
import { CategoryBadge, PageHeader, Placard, Segmented } from '@/components/common/chrome'
import { EmptyState, ListSkeleton, ScreenError, anyFailed } from '@/components/common/state'
import { MemberAvatar } from '@/components/common/people'
import {
  useCastVote,
  useCreateIdea,
  useIdeas,
  useMembers,
  useRemoveIdea,
  useSetAttending,
  useVotes,
} from '@/hooks/queries'
import { useCurrentUserId } from '@/hooks/useSession'
import { agreeThreshold, isOnThePlan, needsADate, tally } from '@/lib/voting'
import { formatDayTime } from '@/lib/dates'
import { messageFor } from '@/lib/errors'
import type { Idea, IdeaCategory, Profile, Vote } from '@/types'

const categories: IdeaCategory[] = ['activity', 'food', 'stay', 'travel']

// The length limits are the server's (backend common/Limits.java); the inputs stop typing at them.
const TITLE_MAX = 100
const DESCRIPTION_MAX = 2000

const tabs = ['plan', 'voting', 'ruled-out'] as const
type Tab = (typeof tabs)[number]

const activitySchema = z.object({
  title: z.string().min(1, 'Give the activity a title.'),
  description: z.string(),
  category: z.enum(['activity', 'food', 'stay', 'travel']),
  proposedStart: z.string(),
})

function PeopleList({
  ids,
  profiles,
  label,
}: {
  ids: string[]
  profiles: Map<string, Profile>
  label: string
}) {
  if (ids.length === 0) return null
  return (
    <div className="flex items-center gap-2">
      <span className="placard caption">{label}</span>
      <span className="flex flex-wrap items-center gap-1">
        {ids.map((id) => {
          const profile = profiles.get(id)
          return profile ? <MemberAvatar key={id} profile={profile} size={22} /> : null
        })}
      </span>
    </div>
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
        try {
          await remove.mutateAsync(idea.id)
          toast.success('Activity deleted')
        } catch (error) {
          toast.error(messageFor(error, 'Could not delete that. Try again.'))
        }
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

/** Something going ahead: who is in, and a way to say you are in or out. */
function PlanRow({
  idea,
  profiles,
  userId,
  tripId,
  isOwner,
}: {
  idea: Idea
  profiles: Map<string, Profile>
  userId: string
  tripId: string
  isOwner: boolean
}) {
  const setAttending = useSetAttending(tripId, userId)
  const creator = profiles.get(idea.proposedBy)
  const going = idea.attendeeIds.includes(userId)
  const count = idea.attendeeIds.length

  const toggle = () =>
    setAttending.mutate(
      { ideaId: idea.id, attending: !going },
      { onError: (error) => toast.error(messageFor(error, 'Could not update that. Try again.')) },
    )

  return (
    <li className="plate flex flex-col gap-3 p-4">
      <ActivityHeading idea={idea} />

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
        {idea.proposedStart ? (
          <span className="tabular text-foreground">{formatDayTime(idea.proposedStart)}</span>
        ) : (
          <span className="text-placard">No date yet</span>
        )}
        <span>
          {idea.status === 'agreed' ? 'Voted in' : 'Added'} by{' '}
          {idea.proposedBy === userId ? 'you' : (creator?.displayName ?? 'a member')}
        </span>
      </div>

      <PeopleList ids={idea.attendeeIds} profiles={profiles} label="Going" />

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
          {idea.proposedBy === userId || isOwner ? <DeleteButton idea={idea} tripId={tripId} /> : null}
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

/** Something still being decided, or ruled out: the vote is the whole story. */
function VoteRow({
  idea,
  votes,
  profiles,
  memberCount,
  userId,
  tripId,
  isOwner,
}: {
  idea: Idea
  votes: Vote[]
  profiles: Map<string, Profile>
  memberCount: number
  userId: string
  tripId: string
  isOwner: boolean
}) {
  const cast = useCastVote(tripId, userId)
  const t = tally(votes, idea.id, userId)
  const threshold = agreeThreshold(memberCount)
  const proposer = profiles.get(idea.proposedBy)

  const vote = (value: 1 | -1) => {
    // Tapping your own vote again clears it.
    cast.mutate(
      { ideaId: idea.id, value: t.own === value ? null : value },
      { onError: (error) => toast.error(messageFor(error, 'Could not save that vote. Try again.')) },
    )
  }

  return (
    <li className="plate flex flex-col gap-3 p-4">
      <ActivityHeading idea={idea} />

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
        <span>Proposed by {proposer?.displayName ?? 'a member'}</span>
        {idea.proposedStart ? (
          <span className="tabular">{formatDayTime(idea.proposedStart)}</span>
        ) : (
          <span className="text-placard">No date yet</span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <PeopleList ids={t.agreeIds} profiles={profiles} label="For" />
        <PeopleList ids={t.disagreeIds} profiles={profiles} label="Against" />
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-bezel pt-3">
        <span className="tabular text-xs text-muted-foreground">
          {t.agree} of {threshold} needed
        </span>
        <div className="flex items-center gap-2">
          {idea.proposedBy === userId || isOwner ? <DeleteButton idea={idea} tripId={tripId} /> : null}
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

type Mode = 'plan' | 'vote'

function AddActivityDrawer({
  tripId,
  members,
  userId,
}: {
  tripId: string
  members: Profile[]
  userId: string
}) {
  const [open, setOpen] = React.useState(false)
  const [mode, setMode] = React.useState<Mode>('plan')
  const everyone = React.useMemo(() => members.map((m) => m.id), [members])
  const [attendeeIds, setAttendeeIds] = React.useState<string[]>(everyone)
  const [attendeeError, setAttendeeError] = React.useState<string | null>(null)
  const create = useCreateIdea(tripId)

  const form = useForm<z.infer<typeof activitySchema>>({
    resolver: zodResolver(activitySchema),
    defaultValues: { title: '', description: '', category: 'activity', proposedStart: '' },
  })

  const toggleAttendee = (id: string) => {
    setAttendeeError(null)
    setAttendeeIds((current) =>
      current.includes(id) ? current.filter((a) => a !== id) : [...current, id],
    )
  }

  const startOver = () => {
    form.reset()
    setMode('plan')
    setAttendeeIds(everyone)
    setAttendeeError(null)
  }

  const submit = form.handleSubmit(async (values) => {
    const needsVote = mode === 'vote'
    // Skipping the vote means there is nothing left to decide, so it needs a
    // time and some people now.
    let blocked = false
    if (!needsVote && !values.proposedStart) {
      form.setError('proposedStart', { message: 'Pick a date and time.' })
      blocked = true
    }
    if (!needsVote && attendeeIds.length === 0) {
      setAttendeeError('Pick at least one person who is going.')
      blocked = true
    }
    if (blocked) return

    try {
      await create.mutateAsync({
        title: values.title,
        description: values.description,
        category: values.category,
        proposedStart: values.proposedStart ? new Date(values.proposedStart).toISOString() : null,
        proposedEnd: null,
        allDay: false,
        needsVote,
        attendeeIds: needsVote ? [] : attendeeIds,
      })
      toast.success(
        needsVote ? 'Put to a vote. You have already agreed with it.' : 'Added to the plan.',
      )
      setOpen(false)
      startOver()
    } catch (error) {
      toast.error(messageFor(error, 'Could not add that activity.'))
    }
  })

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button className="min-h-11">
          <Plus size={16} aria-hidden="true" />
          Add activity
        </Button>
      </DrawerTrigger>
      <DrawerContent>
        <div className="mx-auto w-full max-w-md overflow-y-auto">
          <DrawerHeader>
            <DrawerTitle>Add an activity</DrawerTitle>
            <DrawerDescription>
              {mode === 'plan'
                ? 'It goes straight on the plan and the calendar. No vote needed.'
                : 'It goes to the group to vote on. You count as agreeing with it.'}
            </DrawerDescription>
          </DrawerHeader>
          <form onSubmit={submit} className="flex flex-col gap-5 px-4" noValidate>
            <Segmented
              label="How it gets decided"
              value={mode}
              onChange={(next) => {
                setMode(next)
                form.clearErrors('proposedStart')
                setAttendeeError(null)
              }}
              options={[
                { value: 'plan', label: 'Just add it' },
                { value: 'vote', label: 'Put it to a vote' },
              ]}
            />

            <Field label="What is it" error={form.formState.errors.title?.message} required>
              {({ id, describedBy, invalid }) => (
                <Input
                  id={id}
                  placeholder="Kayak out to the seal colony"
                  maxLength={TITLE_MAX}
                  aria-describedby={describedBy}
                  aria-invalid={invalid}
                  {...form.register('title')}
                />
              )}
            </Field>
            <Field label="Anything the group should know">
              {({ id }) => (
                <Textarea
                  id={id}
                  rows={3}
                  maxLength={DESCRIPTION_MAX}
                  placeholder="Two hours from Marengo. Needs at least four people to book."
                  {...form.register('description')}
                />
              )}
            </Field>
            <Field label="Category">
              {({ id }) => (
                <Select
                  value={form.watch('category')}
                  onValueChange={(v) => form.setValue('category', v as IdeaCategory)}
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
            <Field
              label="When"
              required={mode === 'plan'}
              error={form.formState.errors.proposedStart?.message}
              hint={
                mode === 'vote'
                  ? 'Optional. If it is voted in without a date, it cannot go on the calendar yet.'
                  : undefined
              }
            >
              {({ id, describedBy, invalid }) => (
                <Input
                  id={id}
                  type="datetime-local"
                  aria-describedby={describedBy}
                  aria-invalid={invalid}
                  {...form.register('proposedStart')}
                />
              )}
            </Field>

            {mode === 'plan' ? (
              <fieldset className="flex flex-col gap-3">
                <legend className="placard caption mb-3">Who is going</legend>
                {members.map((m) => (
                  <div key={m.id} className="flex items-center gap-3">
                    <Checkbox
                      id={`attendee-${m.id}`}
                      checked={attendeeIds.includes(m.id)}
                      onCheckedChange={() => toggleAttendee(m.id)}
                    />
                    <Label htmlFor={`attendee-${m.id}`} className="text-sm font-normal">
                      {m.displayName}
                      {m.id === userId ? ' (you)' : ''}
                    </Label>
                  </div>
                ))}
                {attendeeError ? (
                  <p role="alert" className="text-xs text-caution">
                    {attendeeError}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Anyone can say they are in or out later.
                  </p>
                )}
              </fieldset>
            ) : null}

            <DrawerFooter className="px-0">
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? (
                  <Loader2 size={15} className="animate-spin" aria-hidden="true" />
                ) : null}
                {mode === 'plan' ? 'Add to the plan' : 'Put it to a vote'}
              </Button>
            </DrawerFooter>
          </form>
        </div>
      </DrawerContent>
    </Drawer>
  )
}

const isTab = (value: string | null): value is Tab => tabs.includes(value as Tab)

export function ActivitiesPage() {
  const { tripId = '' } = useParams<{ tripId: string }>()
  const [params, setParams] = useSearchParams()
  const userId = useCurrentUserId()
  const ideas = useIdeas(tripId)
  const votes = useVotes(tripId)
  const members = useMembers(tripId, true)

  const profiles = React.useMemo(
    () => new Map((members.data ?? []).map((m) => [m.userId, m.profile])),
    [members.data],
  )

  // The tab lives in the URL, so the overview can link straight to open votes.
  const requested = params.get('tab')
  const tab: Tab = isTab(requested) ? requested : 'plan'
  const setTab = (next: string) =>
    setParams(next === 'plan' ? {} : { tab: next }, { replace: true })

  if (ideas.isPending || votes.isPending || members.isPending) {
    return <ListSkeleton rows={4} />
  }

  // A failed load must say so rather than falling through to an empty state.
  const queries = [ideas, votes, members]
  if (anyFailed(queries)) return <ScreenError queries={queries} />

  const all = ideas.data ?? []
  const allVotes = votes.data ?? []
  const memberProfiles = (members.data ?? []).map((m) => m.profile)
  const memberCount = memberProfiles.length

  // The plan reads in the order it will happen.
  const onThePlan = all
    .filter(isOnThePlan)
    .sort((a, b) => (a.proposedStart ?? '').localeCompare(b.proposedStart ?? ''))
  const undated = onThePlan.filter(needsADate)
  const dated = onThePlan.filter((i) => !needsADate(i))
  const open = all.filter((i) => i.status === 'voting')
  const rejected = all.filter((i) => i.status === 'rejected')

  // The trip's owner can delete anyone's activity; everyone else only their own.
  const isOwner = (members.data ?? []).some((m) => m.userId === userId && m.role === 'owner')
  const planProps = { profiles, userId, tripId, isOwner }
  const voteProps = { votes: allVotes, profiles, memberCount, userId, tripId, isOwner }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Activities"
        subtitle={`What the group is doing. Add something straight to the plan, or put it to a vote: ${agreeThreshold(memberCount)} of ${memberCount} votes carry it.`}
        action={<AddActivityDrawer tripId={tripId} members={memberProfiles} userId={userId} />}
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
            <ul className="flex flex-col gap-3">
              {open.map((idea) => (
                <VoteRow key={idea.id} idea={idea} {...voteProps} />
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="ruled-out" className="mt-4">
          {rejected.length === 0 ? (
            <EmptyState icon={Lightbulb} line="Nothing has been ruled out." />
          ) : (
            <ul className="flex flex-col gap-3">
              {rejected.map((idea) => (
                <VoteRow key={idea.id} idea={idea} {...voteProps} />
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
