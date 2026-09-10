import { latency, read, uid, write } from '@/services/mock/db'
import { ApiError, toBooking } from '@/types'
import type { Booking, BookingType } from '@/types'

export type NewBooking = {
  tripId: string
  type: BookingType
  title: string
  provider: string
  reference: string
  startsAt: string | null
  endsAt: string | null
  origin: string
  destination: string
  costCents: number | null
  belongsTo: string | null
  notes: string
}

export async function list(tripId: string): Promise<Booking[]> {
  await latency()
  return read()
    .bookings.filter((b) => b.trip_id === tripId)
    .map(toBooking)
    .sort((a, b) => (a.startsAt ?? '').localeCompare(b.startsAt ?? ''))
}

export async function create(input: NewBooking): Promise<Booking> {
  await latency()
  if (!input.title.trim()) throw new ApiError('invalid', 'Give the booking a title.')
  const row = write((draft) => {
    const booking = {
      id: uid(),
      trip_id: input.tripId,
      type: input.type,
      title: input.title.trim(),
      provider: input.provider.trim(),
      reference: input.reference.trim(),
      starts_at: input.startsAt,
      ends_at: input.endsAt,
      origin: input.origin.trim(),
      destination: input.destination.trim(),
      cost_cents: input.costCents,
      belongs_to: input.belongsTo,
      notes: input.notes.trim(),
    }
    draft.bookings.push(booking)
    return booking
  })
  return toBooking(row)
}

export async function update(bookingId: string, patch: Partial<Booking>): Promise<Booking> {
  await latency()
  const row = write((draft) => {
    const booking = draft.bookings.find((b) => b.id === bookingId)
    if (!booking) throw new ApiError('not_found', 'That booking has been deleted.')
    if (patch.type !== undefined) booking.type = patch.type
    if (patch.title !== undefined) booking.title = patch.title
    if (patch.provider !== undefined) booking.provider = patch.provider
    if (patch.reference !== undefined) booking.reference = patch.reference
    if (patch.startsAt !== undefined) booking.starts_at = patch.startsAt
    if (patch.endsAt !== undefined) booking.ends_at = patch.endsAt
    if (patch.origin !== undefined) booking.origin = patch.origin
    if (patch.destination !== undefined) booking.destination = patch.destination
    if (patch.costCents !== undefined) booking.cost_cents = patch.costCents
    if (patch.belongsTo !== undefined) booking.belongs_to = patch.belongsTo
    if (patch.notes !== undefined) booking.notes = patch.notes
    return booking
  })
  return toBooking(row)
}

export async function remove(bookingId: string): Promise<void> {
  await latency()
  write((draft) => {
    draft.bookings = draft.bookings.filter((b) => b.id !== bookingId)
  })
}
