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
 *
 * VITE_USE_MOCK=false means "use the real backend wherever one exists". So far
 * that is sign-in (src/services/http/auth.ts), trips with their members
 * (src/services/http/trips.ts) and chat (src/services/http/chat.ts); everything
 * else below keeps running on the mock layer until its backend side is built.
 * Move one module at a time from mockX to httpX as each lands. While the two are mixed, services/mock/bridge.ts mirrors
 * what the backend says into the mock store so the mock screens still work.
 */

import * as httpAuth from '@/services/http/auth'
import * as httpChat from '@/services/http/chat'
import * as httpTrips from '@/services/http/trips'
import * as mockAuth from '@/services/mock/auth'
import * as mockBookings from '@/services/mock/bookings'
import * as mockChat from '@/services/mock/chat'
import * as mockExpenses from '@/services/mock/expenses'
import * as mockFuel from '@/services/mock/fuel'
import * as mockIdeas from '@/services/mock/ideas'
import * as mockTrips from '@/services/mock/trips'
import * as mockVotes from '@/services/mock/votes'
import { reset as resetDb } from '@/services/mock/db'
import { ApiError } from '@/types'

const useMock = import.meta.env.VITE_USE_MOCK !== 'false'

/** What the screens may offer in the current mode. */
export const features = {
  /** The seeded demo account lives only in the mock store, so it needs the mock auth. */
  demoSignIn: useMock,
}

const auth = useMock ? mockAuth : httpAuth
// Trips and members move together: who is on a trip is what the rest of the app counts.
const trips = useMock ? mockTrips : httpTrips
// Chat is its own module: who is on the trip decides who may read it, and the backend enforces that.
const chat = useMock ? mockChat : httpChat

export const api = {
  auth: {
    getSession: auth.getSession,
    signIn: auth.signIn,
    signUp: auth.signUp,
    signInAsDemo: useMock
      ? mockAuth.signInAsDemo
      : () =>
          Promise.reject(
            new ApiError('forbidden', 'The demo trip is only available without a backend.'),
          ),
    signOut: auth.signOut,
  },
  trips: {
    list: trips.list,
    get: trips.get,
    create: trips.create,
    update: trips.update,
    previewByCode: trips.previewByCode,
    joinByCode: trips.joinByCode,
    regenerateCode: trips.regenerateCode,
  },
  members: {
    list: trips.listMembers,
    remove: trips.removeMember,
    updateRole: trips.updateRole,
  },
  ideas: {
    list: mockIdeas.list,
    create: mockIdeas.create,
    update: mockIdeas.update,
    setStatus: mockIdeas.setStatus,
    setAttending: mockIdeas.setAttending,
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
    listChannels: chat.listChannels,
    listMessages: chat.listMessages,
    send: chat.send,
    subscribe: chat.subscribe,
    readState: chat.readState,
    markRead: chat.markRead,
  },
  /** Demo-only escape hatch, surfaced in trip settings. */
  demo: {
    reset: resetDb,
  },
}

export type Api = typeof api
