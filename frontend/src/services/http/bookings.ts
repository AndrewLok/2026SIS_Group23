/*
 * Bookings against the Spring backend (/api/trips/{id}/bookings, /api/bookings/{id}), with the same
 * signatures as services/mock/bookings.ts so client.ts can swap one for the other.
 *
 * Who may change or delete one is decided on the server (the person who added it, the person it is
 * for, or the trip owner), and so is whether the person it is for is really on the trip.
 */

import {
  isNumber,
  isRecord,
  isString,
  isStringOrNull,
  readJson,
  request,
  UNEXPECTED_MESSAGE,
} from '@/services/http/request'
import type { NewBooking } from '@/services/mock/bookings'
import { ApiError } from '@/types'
import type { Booking, BookingType } from '@/types'

const unexpected = (): ApiError => new ApiError('unavailable', UNEXPECTED_MESSAGE)

const TYPES: ReadonlyArray<string> = ['flight', 'stay', 'car', 'other']

function parseBooking(data: unknown): Booking {
  if (
    !isRecord(data) ||
    !isString(data.id) ||
    !isString(data.tripId) ||
    !isString(data.type) ||
    !TYPES.includes(data.type) ||
    !isString(data.title) ||
    !isString(data.provider) ||
    !isString(data.reference) ||
    !isStringOrNull(data.startsAt) ||
    !isStringOrNull(data.endsAt) ||
    !isString(data.origin) ||
    !isString(data.destination) ||
    !(data.costCents === null || isNumber(data.costCents)) ||
    !isStringOrNull(data.belongsTo) ||
    !isString(data.notes) ||
    !isStringOrNull(data.createdBy)
  ) {
    throw unexpected()
  }
  return {
    id: data.id,
    tripId: data.tripId,
    type: data.type as BookingType,
    title: data.title,
    provider: data.provider,
    reference: data.reference,
    startsAt: data.startsAt,
    endsAt: data.endsAt,
    origin: data.origin,
    destination: data.destination,
    costCents: data.costCents,
    belongsTo: data.belongsTo,
    notes: data.notes,
    createdBy: data.createdBy,
  }
}

const bookingPath = (bookingId: string): string => `/bookings/${encodeURIComponent(bookingId)}`

/** In time order, the ones with no time last. */
export async function list(tripId: string): Promise<Booking[]> {
  const response = await request('GET', `/trips/${encodeURIComponent(tripId)}/bookings`)
  const data = await readJson(response)
  if (!Array.isArray(data)) throw unexpected()
  return data.map(parseBooking)
}

export async function create(input: NewBooking): Promise<Booking> {
  const response = await request('POST', `/trips/${encodeURIComponent(input.tripId)}/bookings`, {
    type: input.type,
    title: input.title,
    provider: input.provider,
    reference: input.reference,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    origin: input.origin,
    destination: input.destination,
    costCents: input.costCents,
    belongsTo: input.belongsTo,
    notes: input.notes,
  })
  return parseBooking(await readJson(response))
}

/**
 * Only these can be changed this way. Which trip it is on, who added it and when are fixed, so they
 * are left out of the request even if the patch carries them.
 */
export async function update(bookingId: string, patch: Partial<Booking>): Promise<Booking> {
  const body = {
    type: patch.type,
    title: patch.title,
    provider: patch.provider,
    reference: patch.reference,
    startsAt: patch.startsAt,
    endsAt: patch.endsAt,
    origin: patch.origin,
    destination: patch.destination,
    costCents: patch.costCents,
    belongsTo: patch.belongsTo,
    notes: patch.notes,
  }
  // JSON leaves out what is undefined and keeps what is null, which is the difference between
  // "leave it alone" and "clear it" that the server relies on.
  const response = await request('PATCH', bookingPath(bookingId), body)
  return parseBooking(await readJson(response))
}

export async function remove(bookingId: string): Promise<void> {
  await request('DELETE', bookingPath(bookingId))
}
