/*
 * The trip calendar as a file, against the Spring backend: the person's subscription link, a new
 * link to replace it, and a one-off download. There is no mock version, because the file is built
 * by the server from the shared activities, so the screens only offer this with a real backend
 * (features.calendarExport).
 */

import { isRecord, isString, readJson, request, UNEXPECTED_MESSAGE } from '@/services/http/request'
import { ApiError } from '@/types'

const unexpected = (): ApiError => new ApiError('unavailable', UNEXPECTED_MESSAGE)

const base = (tripId: string): string => `/trips/${encodeURIComponent(tripId)}`

/** The server sends where the link lives on it; the address in front is the one the browser is on. */
function parseFeedPath(data: unknown): string {
  if (!isRecord(data) || !isString(data.path) || !data.path.startsWith('/')) throw unexpected()
  return data.path
}

/** The person's own link, made the first time and the same one after that. */
export async function feedPath(tripId: string): Promise<string> {
  return parseFeedPath(await readJson(await request('GET', `${base(tripId)}/calendar/feed`)))
}

/** A new link. The old one stops working at once. */
export async function renewFeed(tripId: string): Promise<string> {
  return parseFeedPath(await readJson(await request('POST', `${base(tripId)}/calendar/feed`)))
}

export type CalendarFile = { name: string; blob: Blob }

const FALLBACK_NAME = 'voyager-trip.ics'

/** The file name the server suggested, if it is a plain one; otherwise a fixed fallback. */
export function fileNameFrom(disposition: string | null): string {
  const match = disposition?.match(/filename="([A-Za-z0-9._-]+)"/)
  return match?.[1] ?? FALLBACK_NAME
}

export async function download(tripId: string): Promise<CalendarFile> {
  const response = await request('GET', `${base(tripId)}/calendar.ics`)
  let blob: Blob
  try {
    blob = await response.blob()
  } catch {
    throw unexpected()
  }
  return { name: fileNameFrom(response.headers.get('Content-Disposition')), blob }
}
