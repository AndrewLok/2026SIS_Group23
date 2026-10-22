/*
 * What the trip settings screen sends. Only what the person actually changed goes in the patch, which
 * matters for more than tidiness: the server answers 403 to a member who sends an owner-only field,
 * even one that has not changed, and a patch that carries the name along would also overwrite a
 * rename somebody else made while the screen was open.
 */

import { dayToIso, isoToDay } from '@/lib/dates'
import type { Trip } from '@/types'

export type DetailsForm = {
  name: string
  destination: string
  /** A day picker's value ("2026-11-08"), or empty. */
  startDate: string
  endDate: string
  /** In cents, or null for no cap. */
  budgetCapCents: number | null
}

export type SharedForm = {
  allowanceCents: number
  defaultEfficiency: number
  defaultPricePerLitreCents: number
}

/** Owner-only: the trip's name, place, dates and budget cap. */
export function detailsPatch(trip: Trip, form: DetailsForm): Partial<Trip> {
  const patch: Partial<Trip> = {}
  const name = form.name.trim()
  if (name !== trip.name) patch.name = name
  const destination = form.destination.trim()
  if (destination !== trip.destination) patch.destination = destination
  if (form.startDate !== (trip.startDate ? isoToDay(trip.startDate) : '')) {
    patch.startDate = form.startDate ? dayToIso(form.startDate) : null
  }
  if (form.endDate !== (trip.endDate ? isoToDay(trip.endDate) : '')) {
    patch.endDate = form.endDate ? dayToIso(form.endDate) : null
  }
  if (form.budgetCapCents !== trip.budgetCapCents) patch.budgetCapCents = form.budgetCapCents
  return patch
}

/** Open to every member: the allowance each person is assumed to spend, and the fuel defaults. */
export function sharedPatch(trip: Trip, form: SharedForm): Partial<Trip> {
  const patch: Partial<Trip> = {}
  if (form.allowanceCents !== trip.allowanceCents) patch.allowanceCents = form.allowanceCents
  if (form.defaultEfficiency !== trip.defaultEfficiency) {
    patch.defaultEfficiency = form.defaultEfficiency
  }
  if (form.defaultPricePerLitreCents !== trip.defaultPricePerLitreCents) {
    patch.defaultPricePerLitreCents = form.defaultPricePerLitreCents
  }
  return patch
}

export const isEmptyPatch = (patch: object): boolean => Object.keys(patch).length === 0
