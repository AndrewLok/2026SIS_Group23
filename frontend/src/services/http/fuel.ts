/*
 * Fuel legs against the Spring backend (/api/trips/{id}/fuel-legs, /api/fuel-legs/{id}), with the same
 * signatures as services/mock/fuel.ts so client.ts can swap one for the other.
 *
 * What the server decides: that the driver and everyone chipping in are on the trip, that the leg
 * costs something, and who may change or delete one (the person who added it, the driver, or the trip
 * owner). Every leg also has an expense on the money screen, paid by the driver. The server writes it,
 * keeps it in step with the leg and removes it with the leg, all in one go, so there is nothing for
 * this file to mirror. Its cost is worked out on both sides with the same sum (lib/fuel.ts here,
 * FuelCost on the server), which is why the server never sends one.
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
import type { NewFuelLeg } from '@/services/mock/fuel'
import { ApiError } from '@/types'
import type { FuelLeg } from '@/types'

const unexpected = (): ApiError => new ApiError('unavailable', UNEXPECTED_MESSAGE)

function parseLeg(data: unknown): FuelLeg {
  if (
    !isRecord(data) ||
    !isString(data.id) ||
    !isString(data.tripId) ||
    !isString(data.label) ||
    !isNumber(data.distanceKm) ||
    !isNumber(data.efficiencyL100km) ||
    !isNumber(data.pricePerLitreCents) ||
    !isString(data.driverId) ||
    !Array.isArray(data.riderIds) ||
    !data.riderIds.every(isString) ||
    !isStringOrNull(data.createdBy) ||
    !isString(data.createdAt)
  ) {
    throw unexpected()
  }
  return {
    id: data.id,
    tripId: data.tripId,
    label: data.label,
    distanceKm: data.distanceKm,
    efficiencyL100km: data.efficiencyL100km,
    pricePerLitreCents: data.pricePerLitreCents,
    driverId: data.driverId,
    riderIds: [...data.riderIds],
    createdBy: data.createdBy,
    createdAt: data.createdAt,
  }
}

const legPath = (legId: string): string => `/fuel-legs/${encodeURIComponent(legId)}`

/** In the order they were made. */
export async function list(tripId: string): Promise<FuelLeg[]> {
  const response = await request('GET', `/trips/${encodeURIComponent(tripId)}/fuel-legs`)
  const data = await readJson(response)
  if (!Array.isArray(data)) throw unexpected()
  return data.map(parseLeg)
}

export async function create(input: NewFuelLeg): Promise<FuelLeg> {
  const response = await request('POST', `/trips/${encodeURIComponent(input.tripId)}/fuel-legs`, {
    label: input.label,
    distanceKm: input.distanceKm,
    efficiencyL100km: input.efficiencyL100km,
    pricePerLitreCents: input.pricePerLitreCents,
    driverId: input.driverId,
    riderIds: input.riderIds,
  })
  return parseLeg(await readJson(response))
}

/**
 * Only these can be changed. Which trip it is on, who added it and when are fixed, so they are left
 * out of the request even if the patch carries them. JSON leaves out what is undefined, which is
 * "leave it alone" to the server.
 */
export async function update(legId: string, patch: Partial<FuelLeg>): Promise<FuelLeg> {
  const response = await request('PATCH', legPath(legId), {
    label: patch.label,
    distanceKm: patch.distanceKm,
    efficiencyL100km: patch.efficiencyL100km,
    pricePerLitreCents: patch.pricePerLitreCents,
    driverId: patch.driverId,
    riderIds: patch.riderIds,
  })
  return parseLeg(await readJson(response))
}

export async function remove(legId: string): Promise<void> {
  await request('DELETE', legPath(legId))
}
