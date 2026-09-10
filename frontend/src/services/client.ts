/*
 * The swap point.
 *
 * Every component and every query hook talks to this object and nothing else.
 * Wiring a real backend means rewriting the modules behind it while keeping the
 * method signatures, and no screen changes.
 *
 * The mock layer stays in the repo behind VITE_USE_MOCK so the app remains
 * demoable with no backend running, which matters in a group project where the
 * backend lives on someone else's branch.
 */

import * as mockAuth from '@/services/mock/auth'
import * as mockBookings from '@/services/mock/bookings'
import * as mockChat from '@/services/mock/chat'
import * as mockExpenses from '@/services/mock/expenses'
import * as mockFuel from '@/services/mock/fuel'
import * as mockIdeas from '@/services/mock/ideas'
import * as mockTrips from '@/services/mock/trips'
import * as mockVotes from '@/services/mock/votes'
import { reset as resetDb } from '@/services/mock/db'

const useMock = import.meta.env.VITE_USE_MOCK !== 'false'

if (!useMock) {
  // Left deliberately loud: there is no HTTP implementation yet, and the group
  // has not settled which backend this points at. See section 10 of the plan.
  throw new Error(
    'VITE_USE_MOCK=false, but no real backend client exists yet. Remove the flag or implement it here.',
  )
}

export const api = {
  auth: {
    getSession: mockAuth.getSession,
    signIn: mockAuth.signIn,
    signUp: mockAuth.signUp,
    signInAsDemo: mockAuth.signInAsDemo,
    signOut: mockAuth.signOut,
  },
  trips: {
    list: mockTrips.list,
    get: mockTrips.get,
    create: mockTrips.create,
    update: mockTrips.update,
    previewByCode: mockTrips.previewByCode,
    joinByCode: mockTrips.joinByCode,
    regenerateCode: mockTrips.regenerateCode,
  },
  members: {
    list: mockTrips.listMembers,
    remove: mockTrips.removeMember,
    updateRole: mockTrips.updateRole,
  },
  ideas: {
    list: mockIdeas.list,
    create: mockIdeas.create,
    update: mockIdeas.update,
    setStatus: mockIdeas.setStatus,
    remove: mockIdeas.remove,
  },
  votes: {
    listForTrip: mockVotes.listForTrip,
    cast: mockVotes.cast,
    clear: mockVotes.clear,
  },
  bookings: {
    list: mockBookings.list,
    create: mockBookings.create,
    update: mockBookings.update,
    remove: mockBookings.remove,
  },
  fuel: {
    list: mockFuel.list,
    create: mockFuel.create,
    update: mockFuel.update,
    remove: mockFuel.remove,
  },
  expenses: {
    list: mockExpenses.list,
    create: mockExpenses.create,
    update: mockExpenses.update,
    remove: mockExpenses.remove,
  },
  chat: {
    listChannels: mockChat.listChannels,
    listMessages: mockChat.listMessages,
    send: mockChat.send,
    subscribe: mockChat.subscribe,
    unreadCount: mockChat.unreadCount,
    markRead: mockChat.markRead,
  },
  /** Demo-only escape hatch, surfaced in trip settings. */
  demo: {
    reset: resetDb,
  },
}

export type Api = typeof api
