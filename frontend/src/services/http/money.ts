/* Bookings, fuel legs and expenses: the three trip ledgers, all plain CRUD over HTTP. */

import { request, seg } from '@/services/http/request'
import type { NewBooking } from '@/services/mock/bookings'
import type { NewExpense } from '@/services/mock/expenses'
import type { NewFuelLeg } from '@/services/mock/fuel'
import type { Booking, Expense, FuelLeg } from '@/types'

export const bookings = {
  list: (tripId: string): Promise<Booking[]> => request('GET', `/trips/${seg(tripId)}/bookings`),
  create: ({ tripId, ...input }: NewBooking): Promise<Booking> =>
    request('POST', `/trips/${seg(tripId)}/bookings`, input),
  update: (bookingId: string, patch: Partial<Booking>): Promise<Booking> =>
    request('PATCH', `/bookings/${seg(bookingId)}`, patch),
  remove: (bookingId: string): Promise<void> => request('DELETE', `/bookings/${seg(bookingId)}`),
}

/** Creating, editing or deleting a leg also writes its fuel expense, server side. */
export const fuel = {
  list: (tripId: string): Promise<FuelLeg[]> => request('GET', `/trips/${seg(tripId)}/fuel`),
  create: ({ tripId, ...input }: NewFuelLeg): Promise<FuelLeg> =>
    request('POST', `/trips/${seg(tripId)}/fuel`, input),
  update: (legId: string, patch: Partial<FuelLeg>): Promise<FuelLeg> =>
    request('PATCH', `/fuel/${seg(legId)}`, patch),
  remove: (legId: string): Promise<void> => request('DELETE', `/fuel/${seg(legId)}`),
}

export const expenses = {
  list: (tripId: string): Promise<Expense[]> => request('GET', `/trips/${seg(tripId)}/expenses`),
  create: ({ tripId, ...input }: NewExpense): Promise<Expense> =>
    request('POST', `/trips/${seg(tripId)}/expenses`, input),
  update: (expenseId: string, patch: Partial<Expense>): Promise<Expense> =>
    request('PATCH', `/expenses/${seg(expenseId)}`, patch),
  remove: (expenseId: string): Promise<void> => request('DELETE', `/expenses/${seg(expenseId)}`),
}
