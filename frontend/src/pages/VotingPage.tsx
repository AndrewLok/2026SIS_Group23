import * as React from 'react'
import { useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { CalendarPlus, Lightbulb, Loader2, Plus, ThumbsDown, ThumbsUp, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import { CategoryBadge, PageHeader, Placard } from '@/components/common/chrome'
import { EmptyState, ListSkeleton, ScreenError, anyFailed } from '@/components/common/state'
import { MemberAvatar } from '@/components/common/people'
import {
  useCastVote,
  useCreateIdea,
  useIdeas,
  useMembers,
  useRemoveIdea,
  useVotes,
} from '@/hooks/queries'
import { useCurrentUserId } from '@/hooks/useSession'
import { agreeThreshold, needsADate, tally } from '@/lib/voting'
import { formatDayTime } from '@/lib/dates'
import type { Idea, IdeaCategory, Profile, Vote } from '@/types'

const categories: IdeaCategory[] = ['activity', 'food', 'stay', 'travel']

const ideaSchema = z.object({
  title: z.string().min(1, 'Give the idea a title.'),
  description: z.string(),
  category: z.enum(['activity', 'food', 'stay', 'travel']),
  proposedStart: z.string(),
})

function VoterList({
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
      <span className="placard text-[0.5625rem]">{label}</span>
      <span className="flex items-center gap-1">
        {ids.map((id) => {
          const profile = profiles.get(id)
          return profile ? <MemberAvatar key={id} profile={profile} size={22} /> : null
        })}
      </span>
    </div>
  )
}

function IdeaRow({
  idea,
  votes,
  profiles,
  memberCount,
  userId,
  tripId,
}: {
  idea: Idea
  votes: Vote[]
  profiles: Map<string, Profile>
  memberCount: number
  userId: string
  tripId: string
}) {
  const cast = useCastVote(tripId, userId)
  const remove = useRemoveIdea(tripId)
  const t = tally(votes, idea.id, userId)
  const threshold = agreeThreshold(memberCount)
  const proposer = profiles.get(idea.proposedBy)
  const canDelete = idea.proposedBy === userId

  const vote = (value: 1 | -1) => {
    // Tapping your own vote again clears it.
    cast.mutate({ ideaId: idea.id, value: t.own === value ? null : value })
  }

  return (
    <li className="plate flex flex-col gap-3 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-medium">{idea.title}</h3>
          {idea.description ? (
            <p className="mt-1 text-sm text-muted-foreground">{idea.description}</p>
          ) : null}
        </div>
        <CategoryBadge category={idea.category} kind="idea" className="shrink-0" />
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
        <span>Proposed by {proposer?.displayName ?? 'a member'}</span>
        {idea.proposedStart ? (
          <span className="tabular">{formatDayTime(idea.proposedStart)}</span>
        ) : (
          <span className="text-placard">No date yet</span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <VoterList ids={t.agreeIds} profiles={profiles} label="For" />
        <VoterList ids={t.disagreeIds} profiles={profiles} label="Against" />
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-bezel pt-3">
        <span className="tabular text-xs text-muted-foreground">
          {t.agree} of {threshold} needed
        </span>
        <div className="flex items-center gap-2">
          {canDelete ? (
            <Button
              variant="ghost"
              size="icon"
              className="size-11 text-placard"
              onClick={async () => {
                await remove.mutateAsync(idea.id)
                toast.success('Idea deleted')
              }}
            >
              <Trash2 size={14} aria-hidden="true" />
              <span className="sr-only">Delete {idea.title}</span>
            </Button>
          ) : null}
          <Button
            variant={t.own === -1 ? 'default' : 'outline'}
            size="sm"
            onClick={() => vote(-1)}
            aria-pressed={t.own === -1}
            className={`min-h-11 min-w-14 ${t.own === -1 ? 'bg-caution text-panel hover:bg-caution/90' : ''}`}
          >
            <ThumbsDown size={14} aria-hidden="true" />
            {t.disagree}
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
          </Button>
        </div>
      </div>
    </li>
  )
}

function ProposeIdeaDrawer({ tripId }: { tripId: string }) {
  const [open, setOpen] = React.useState(false)
  const create = useCreateIdea(tripId)
  const form = useForm<z.infer<typeof ideaSchema>>({
    resolver: zodResolver(ideaSchema),
    defaultValues: { title: '', description: '', category: 'activity', proposedStart: '' },
  })

  const submit = form.handleSubmit(async (values) => {
    try {
      await create.mutateAsync({
        title: values.title,
        description: values.description,
        category: values.category,
        proposedStart: values.proposedStart ? new Date(values.proposedStart).toISOString() : null,
        proposedEnd: null,
        allDay: false,
      })
      toast.success('Idea proposed. You have already agreed with it.')
      setOpen(false)
      form.reset()
    } catch {
      toast.error('Could not propose that idea.')
    }
  })

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button className="min-h-11">
          <Plus size={16} aria-hidden="true" />
          Propose an idea
        </Button>
      </DrawerTrigger>
      <DrawerContent>
        <div className="mx-auto w-full max-w-md">
          <DrawerHeader>
            <DrawerTitle>Propose an idea</DrawerTitle>
            <DrawerDescription>
              It goes to the group to vote on. You count as agreeing with it.
            </DrawerDescription>
          </DrawerHeader>
          <form onSubmit={submit} className="flex flex-col gap-5 px-4" noValidate>
            <Field label="What is it" error={form.formState.errors.title?.message} required>
              {({ id, describedBy, invalid }) => (
                <Input
                  id={id}
                  placeholder="Kayak out to the seal colony"
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
            <Field label="When" hint="Optional. An agreed idea with no date cannot go on the calendar yet.">
              {({ id }) => <Input id={id} type="datetime-local" {...form.register('proposedStart')} />}
            </Field>
            <DrawerFooter className="px-0">
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? (
                  <Loader2 size={15} className="animate-spin" aria-hidden="true" />
                ) : null}
                Propose it
              </Button>
            </DrawerFooter>
          </form>
        </div>
      </DrawerContent>
    </Drawer>
  )
}

export function VotingPage() {
  const { tripId = '' } = useParams<{ tripId: string }>()
  const userId = useCurrentUserId()
  const ideas = useIdeas(tripId)
  const votes = useVotes(tripId)
  const members = useMembers(tripId)

  const profiles = React.useMemo(
    () => new Map((members.data ?? []).map((m) => [m.userId, m.profile])),
    [members.data],
  )

  if (ideas.isPending || votes.isPending || members.isPending) {
    return <ListSkeleton rows={4} />
  }

  // A failed load must say so rather than falling through to an empty state.
  const queries = [ideas, votes, members]
  if (anyFailed(queries)) return <ScreenError queries={queries} />

  const all = ideas.data ?? []
  const allVotes = votes.data ?? []
  const memberCount = members.data?.length ?? 0

  const open = all.filter((i) => i.status === 'voting')
  const agreed = all.filter((i) => i.status === 'agreed')
  const rejected = all.filter((i) => i.status === 'rejected')
  const undated = agreed.filter(needsADate)
  const dated = agreed.filter((i) => !needsADate(i))

  const rowProps = { votes: allVotes, profiles, memberCount, userId, tripId }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Voting"
        subtitle={`An idea is agreed once ${agreeThreshold(memberCount)} of ${memberCount} members are for it.`}
        action={<ProposeIdeaDrawer tripId={tripId} />}
      />

      <Tabs defaultValue="open">
        <TabsList className="w-full">
          <TabsTrigger value="open" className="flex-1">
            Open {open.length > 0 ? `(${open.length})` : ''}
          </TabsTrigger>
          <TabsTrigger value="agreed" className="flex-1">
            Agreed {agreed.length > 0 ? `(${agreed.length})` : ''}
          </TabsTrigger>
          <TabsTrigger value="rejected" className="flex-1">
            Rejected {rejected.length > 0 ? `(${rejected.length})` : ''}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="open" className="mt-4">
          {open.length === 0 ? (
            <EmptyState
              icon={Lightbulb}
              line="Nothing waiting on a vote. Propose something and the group can call it."
            />
          ) : (
            <ul className="flex flex-col gap-3">
              {open.map((idea) => (
                <IdeaRow key={idea.id} idea={idea} {...rowProps} />
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="agreed" className="mt-4 flex flex-col gap-5">
          {undated.length > 0 ? (
            <section className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <Placard className="border-caution/40 text-caution">
                  <CalendarPlus size={12} className="mr-1.5" aria-hidden="true" />
                  Agreed, needs a date
                </Placard>
                <span className="text-xs text-muted-foreground">
                  These cannot go on the calendar yet.
                </span>
              </div>
              <ul className="flex flex-col gap-3">
                {undated.map((idea) => (
                  <IdeaRow key={idea.id} idea={idea} {...rowProps} />
                ))}
              </ul>
            </section>
          ) : null}

          {dated.length > 0 ? (
            <ul className="flex flex-col gap-3">
              {dated.map((idea) => (
                <IdeaRow key={idea.id} idea={idea} {...rowProps} />
              ))}
            </ul>
          ) : null}

          {agreed.length === 0 ? (
            <EmptyState icon={Lightbulb} line="Nothing agreed yet. Ideas move here once enough of you are for them." />
          ) : null}
        </TabsContent>

        <TabsContent value="rejected" className="mt-4">
          {rejected.length === 0 ? (
            <EmptyState icon={Lightbulb} line="Nothing has been ruled out." />
          ) : (
            <ul className="flex flex-col gap-3">
              {rejected.map((idea) => (
                <IdeaRow key={idea.id} idea={idea} {...rowProps} />
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
