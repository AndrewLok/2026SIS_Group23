import { describe, expect, it } from 'vitest'
import { ideaEditProblem, ideaPatch } from '@/lib/ideaEdit'
import type { IdeaEditForm } from '@/lib/ideaEdit'
import { isoToLocalInput } from '@/lib/dates'
import type { Idea } from '@/types'

const START = '2030-06-15T02:30:00.000Z'
const END = '2030-06-15T05:00:00.000Z'

const IDEA: Idea = {
  id: 'i-1',
  tripId: 't-1',
  title: 'Kayak to the seal colony',
  description: 'Two hours',
  category: 'activity',
  proposedStart: START,
  proposedEnd: END,
  allDay: false,
  status: 'planned',
  proposedBy: 'u-priya',
  attendeeIds: ['u-priya', 'u-jonas'],
  createdAt: '2030-01-01T00:00:00Z',
}

const SAME: IdeaEditForm = {
  title: IDEA.title,
  description: IDEA.description,
  category: 'activity',
  proposedStart: isoToLocalInput(START),
  proposedEnd: isoToLocalInput(END),
  allDay: false,
  attendeeIds: ['u-jonas', 'u-priya'],
}

describe('what to send', () => {
  it('is nothing when nothing changed, whatever order the people are in', () => {
    expect(ideaPatch(IDEA, SAME, true)).toEqual({})
  })

  it('is only the field that changed', () => {
    expect(ideaPatch(IDEA, { ...SAME, title: 'Sea kayak' }, true)).toEqual({ title: 'Sea kayak' })
    expect(ideaPatch(IDEA, { ...SAME, category: 'food' }, true)).toEqual({ category: 'food' })
    expect(ideaPatch(IDEA, { ...SAME, allDay: true }, true)).toEqual({ allDay: true })
  })

  it('ignores stray spaces, and sends a description cleared to nothing as an empty string', () => {
    expect(ideaPatch(IDEA, { ...SAME, title: ` ${IDEA.title}  `, description: '  Two hours ' }, true)).toEqual({})
    expect(ideaPatch(IDEA, { ...SAME, description: '' }, true)).toEqual({ description: '' })
  })

  it('turns a changed time into the stored instant, and a cleared one into null', () => {
    const later = ideaPatch(IDEA, { ...SAME, proposedEnd: '2030-06-15T18:00' }, true)
    expect(later.proposedEnd).toBe(new Date('2030-06-15T18:00').toISOString())
    expect(later).not.toHaveProperty('proposedStart')
    expect(ideaPatch(IDEA, { ...SAME, proposedEnd: '' }, true)).toEqual({ proposedEnd: null })
    const voting = { ...IDEA, status: 'voting' as const, proposedStart: null, proposedEnd: null }
    expect(ideaPatch(voting, { ...SAME, proposedStart: '', proposedEnd: '' }, false)).toEqual({})
  })

  it('sends who is going only when it is going ahead, and only when that changed', () => {
    expect(ideaPatch(IDEA, { ...SAME, attendeeIds: ['u-priya'] }, true)).toEqual({ attendeeIds: ['u-priya'] })
    expect(ideaPatch(IDEA, { ...SAME, attendeeIds: [] }, true)).toEqual({ attendeeIds: [] })
    expect(ideaPatch(IDEA, { ...SAME, attendeeIds: ['u-priya'] }, false)).toEqual({})
  })

  it('never sends the status, who proposed it, or anything else the server ignores', () => {
    const patch = ideaPatch(IDEA, { ...SAME, title: 'x', category: 'food', allDay: true }, true)
    for (const key of ['status', 'proposedBy', 'id', 'tripId', 'createdAt']) {
      expect(patch).not.toHaveProperty(key)
    }
  })
})

describe('what to check first', () => {
  it('passes a form that is fine', () => {
    expect(ideaEditProblem(IDEA, SAME)).toBeNull()
  })

  it('wants a title', () => {
    expect(ideaEditProblem(IDEA, { ...SAME, title: '   ' })).toEqual({
      field: 'title',
      message: 'Give the activity a title.',
    })
  })

  it('wants a time for something that is already on the plan, but not for something being voted on', () => {
    expect(ideaEditProblem(IDEA, { ...SAME, proposedStart: '', proposedEnd: '' })).toEqual({
      field: 'proposedStart',
      message: 'Pick a date and time.',
    })
    const voting = { ...IDEA, status: 'voting' as const }
    expect(ideaEditProblem(voting, { ...SAME, proposedStart: '', proposedEnd: '' })).toBeNull()
    // Once it has been voted in, it may still have no time yet.
    const agreed = { ...IDEA, status: 'agreed' as const }
    expect(ideaEditProblem(agreed, { ...SAME, proposedStart: '', proposedEnd: '' })).toBeNull()
  })

  it('does not allow an end with no start', () => {
    const voting = { ...IDEA, status: 'voting' as const }
    expect(ideaEditProblem(voting, { ...SAME, proposedStart: '', proposedEnd: '2030-06-15T18:00' })).toEqual({
      field: 'proposedEnd',
      message: 'Add a start time before an end time.',
    })
  })

  it('does not allow an end before the start, but does allow the same moment', () => {
    expect(ideaEditProblem(IDEA, { ...SAME, proposedStart: '2030-06-15T18:00', proposedEnd: '2030-06-15T17:00' })).toEqual({
      field: 'proposedEnd',
      message: 'It cannot end before it starts.',
    })
    expect(ideaEditProblem(IDEA, { ...SAME, proposedStart: '2030-06-15T18:00', proposedEnd: '2030-06-15T18:00' })).toBeNull()
  })
})
