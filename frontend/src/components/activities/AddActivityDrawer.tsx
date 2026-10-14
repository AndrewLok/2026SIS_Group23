/*
 * The add-activity form, shared by the activities list and the calendar grid.
 * The header button opens it blank; picking a slot on the calendar opens it
 * set to a vote at that time.
 */

import * as React from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2 } from 'lucide-react'
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
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import { Field } from '@/components/common/Field'
import { Segmented } from '@/components/common/chrome'
import { useCreateIdea } from '@/hooks/queries'
import type { ActivityMode, ActivityPreset } from '@/lib/schedule'
import type { IdeaCategory, Profile } from '@/types'

const categories: IdeaCategory[] = ['activity', 'food', 'stay', 'travel']

const activitySchema = z.object({
  title: z.string().min(1, 'Give the activity a title.'),
  description: z.string(),
  category: z.enum(['activity', 'food', 'stay', 'travel']),
  proposedStart: z.string(),
  proposedEnd: z.string(),
})

export function AddActivityDrawer({
  tripId,
  members,
  userId,
  open,
  onOpenChange,
  preset,
  onAdded,
}: {
  tripId: string
  members: Profile[]
  userId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  /** What the form starts with: the header button opens it blank, the schedule pre-filled. */
  preset: ActivityPreset
  onAdded: (mode: ActivityMode) => void
}) {
  const [mode, setMode] = React.useState<ActivityMode>(preset.mode)
  const everyone = React.useMemo(() => members.map((m) => m.id), [members])
  const [attendeeIds, setAttendeeIds] = React.useState<string[]>(everyone)
  const [attendeeError, setAttendeeError] = React.useState<string | null>(null)
  const create = useCreateIdea(tripId)

  const form = useForm<z.infer<typeof activitySchema>>({
    resolver: zodResolver(activitySchema),
    defaultValues: {
      title: '',
      description: '',
      category: 'activity',
      proposedStart: preset.start,
      proposedEnd: preset.end,
    },
  })

  // Every opening starts from the preset it was opened with.
  React.useEffect(() => {
    if (!open) return
    form.reset({
      title: '',
      description: '',
      category: 'activity',
      proposedStart: preset.start,
      proposedEnd: preset.end,
    })
    setMode(preset.mode)
    setAttendeeIds(everyone)
    setAttendeeError(null)
  }, [open, preset, everyone, form])

  const toggleAttendee = (id: string) => {
    setAttendeeError(null)
    setAttendeeIds((current) =>
      current.includes(id) ? current.filter((a) => a !== id) : [...current, id],
    )
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
    if (values.proposedEnd && !values.proposedStart) {
      form.setError('proposedStart', { message: 'Pick when it starts too.' })
      blocked = true
    }
    if (values.proposedStart && values.proposedEnd && values.proposedEnd <= values.proposedStart) {
      form.setError('proposedEnd', { message: 'It has to finish after it starts.' })
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
        proposedEnd: values.proposedEnd ? new Date(values.proposedEnd).toISOString() : null,
        allDay: false,
        needsVote,
        attendeeIds: needsVote ? [] : attendeeIds,
      })
      toast.success(
        needsVote ? 'Put to a vote. You have already agreed with it.' : 'Added to the plan.',
      )
      onOpenChange(false)
      onAdded(mode)
    } catch {
      toast.error('Could not add that activity.')
    }
  })

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
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
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Starts"
                required={mode === 'plan'}
                error={form.formState.errors.proposedStart?.message}
                hint={
                  mode === 'vote'
                    ? 'Optional. Anyone can add a date later.'
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
              <Field label="Finishes" error={form.formState.errors.proposedEnd?.message}>
                {({ id, describedBy, invalid }) => (
                  <Input
                    id={id}
                    type="datetime-local"
                    aria-describedby={describedBy}
                    aria-invalid={invalid}
                    {...form.register('proposedEnd')}
                  />
                )}
              </Field>
            </div>

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

