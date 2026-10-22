/*
 * Editing an activity: what to check on the form, and what to send. Only what changed is sent. The
 * server treats a missing key as "leave it alone" and a null as "clear it", and a patch that restated
 * everything would also overwrite a change somebody else made while the form was open.
 */

import { isoToLocalInput, localInputToIso } from '@/lib/dates'
import type { Idea, IdeaCategory } from '@/types'

export type IdeaEditForm = {
  title: string
  description: string
  category: IdeaCategory
  /** A date-and-time picker's value ("2026-11-08T14:30"), or empty. */
  proposedStart: string
  proposedEnd: string
  allDay: boolean
  /** Who is going. Only used once the activity is going ahead. */
  attendeeIds: string[]
}

export type IdeaEditProblem = {
  field: 'title' | 'proposedStart' | 'proposedEnd'
  message: string
}

/** The same rules the server applies, so the form can say so before it is sent. */
export function ideaEditProblem(idea: Idea, form: IdeaEditForm): IdeaEditProblem | null {
  if (!form.title.trim()) {
    return { field: 'title', message: 'Give the activity a title.' }
  }
  if (idea.status === 'planned' && !form.proposedStart) {
    return { field: 'proposedStart', message: 'Pick a date and time.' }
  }
  if (form.proposedEnd && !form.proposedStart) {
    return { field: 'proposedEnd', message: 'Add a start time before an end time.' }
  }
  const start = localInputToIso(form.proposedStart)
  const end = localInputToIso(form.proposedEnd)
  if (start && end && end < start) {
    return { field: 'proposedEnd', message: 'It cannot end before it starts.' }
  }
  return null
}

const sameSet = (a: string[], b: string[]): boolean => {
  const left = new Set(a)
  const right = new Set(b)
  return left.size === right.size && [...left].every((id) => right.has(id))
}

const asInput = (iso: string | null): string => (iso ? isoToLocalInput(iso) : '')

export function ideaPatch(idea: Idea, form: IdeaEditForm, onThePlan: boolean): Partial<Idea> {
  const patch: Partial<Idea> = {}
  if (form.title.trim() !== idea.title) patch.title = form.title.trim()
  if (form.description.trim() !== idea.description) patch.description = form.description.trim()
  if (form.category !== idea.category) patch.category = form.category
  if (form.proposedStart !== asInput(idea.proposedStart)) {
    patch.proposedStart = localInputToIso(form.proposedStart)
  }
  if (form.proposedEnd !== asInput(idea.proposedEnd)) {
    patch.proposedEnd = localInputToIso(form.proposedEnd)
  }
  if (form.allDay !== idea.allDay) patch.allDay = form.allDay
  // Who is going can only be set once it is going ahead; while it is a vote, the votes say.
  if (onThePlan && !sameSet(form.attendeeIds, idea.attendeeIds)) {
    patch.attendeeIds = [...new Set(form.attendeeIds)]
  }
  return patch
}
