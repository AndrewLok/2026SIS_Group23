/*
 * Editing a booking: the form's values from a booking, and the patch back from the form. Only what
 * changed is sent. The server reads a missing key as "leave it alone" and a null as "clear it" (no
 * time, no cost, the whole group), and a patch that restated everything would also overwrite a
 * change somebody else made while the form was open.
 */

import { isoToLocalInput, localInputToIso } from '@/lib/dates'
import type { Booking, BookingType } from '@/types'

export type BookingForm = {
  type: BookingType
  title: string
  provider: string
  reference: string
  /** A date-and-time picker's value ("2026-11-08T14:30"), or empty. */
  startsAt: string
  endsAt: string
  origin: string
  destination: string
  notes: string
  /** "group" for the whole group, otherwise a member's id. */
  belongsTo: string
}

export const GROUP = 'group'

export function bookingFormOf(booking: Booking): BookingForm {
  return {
    type: booking.type,
    title: booking.title,
    provider: booking.provider,
    reference: booking.reference,
    startsAt: booking.startsAt ? isoToLocalInput(booking.startsAt) : '',
    endsAt: booking.endsAt ? isoToLocalInput(booking.endsAt) : '',
    origin: booking.origin,
    destination: booking.destination,
    notes: booking.notes,
    belongsTo: booking.belongsTo ?? GROUP,
  }
}

export function bookingPatch(
  booking: Booking,
  form: BookingForm,
  costCents: number | null,
): Partial<Booking> {
  const was = bookingFormOf(booking)
  const patch: Partial<Booking> = {}
  if (form.type !== was.type) patch.type = form.type
  if (form.title !== was.title) patch.title = form.title
  if (form.provider !== was.provider) patch.provider = form.provider
  if (form.reference !== was.reference) patch.reference = form.reference
  if (form.startsAt !== was.startsAt) patch.startsAt = localInputToIso(form.startsAt)
  if (form.endsAt !== was.endsAt) patch.endsAt = localInputToIso(form.endsAt)
  if (form.origin !== was.origin) patch.origin = form.origin
  if (form.destination !== was.destination) patch.destination = form.destination
  if (form.notes !== was.notes) patch.notes = form.notes
  if (form.belongsTo !== was.belongsTo) {
    patch.belongsTo = form.belongsTo === GROUP ? null : form.belongsTo
  }
  if (costCents !== booking.costCents) patch.costCents = costCents
  return patch
}
