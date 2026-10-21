/*
 * The swap point.
 *
 * Every component and every query hook talks to this object and nothing else. There are
 * two implementations behind it with identical signatures, and no screen knows which one
 * it is using:
 *
 *   mock  an in-browser store (src/services/mock), so the app stays demoable with no
 *         backend running. The default.
 *   http  the Spring backend in /backend (src/services/http). Run `npm run dev:backend`,
 *         or set VITE_USE_MOCK=false.
 */

import * as httpAuth from '@/services/http/auth'
import * as httpChat from '@/services/http/chat'
import * as httpDemo from '@/services/http/demo'
import * as httpIdeas from '@/services/http/ideas'
import * as httpMoney from '@/services/http/money'
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

const mockApi = {
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
    listChannels: mockChat.listChannels,
    listMessages: mockChat.listMessages,
    send: mockChat.send,
    subscribe: mockChat.subscribe,
    unreadCount: mockChat.unreadCount,
    firstUnreadId: mockChat.firstUnreadId,
    markRead: mockChat.markRead,
  },
  /** Demo-only escape hatch, surfaced in trip settings. */
  demo: {
    reset: async (): Promise<void> => resetDb(),
  },
}

export type Api = typeof mockApi

/** Typed against the mock, so a signature drifting on either side fails the build. */
const httpApi: Api = {
  auth: {
    getSession: httpAuth.getSession,
    signIn: httpAuth.signIn,
    signUp: httpAuth.signUp,
    signInAsDemo: httpAuth.signInAsDemo,
    signOut: httpAuth.signOut,
  },
  trips: {
    list: httpTrips.list,
    get: httpTrips.get,
    create: httpTrips.create,
    update: httpTrips.update,
    previewByCode: httpTrips.previewByCode,
    joinByCode: httpTrips.joinByCode,
    regenerateCode: httpTrips.regenerateCode,
  },
  members: {
    list: httpTrips.listMembers,
    remove: httpTrips.removeMember,
    updateRole: httpTrips.updateRole,
  },
  ideas: {
    list: httpIdeas.list,
    create: httpIdeas.create,
    update: httpIdeas.update,
    setStatus: httpIdeas.setStatus,
    setAttending: httpIdeas.setAttending,
    remove: httpIdeas.remove,
  },
  votes: {
    listForTrip: httpIdeas.listVotes,
    cast: httpIdeas.cast,
    clear: httpIdeas.clear,
  },
  bookings: httpMoney.bookings,
  fuel: httpMoney.fuel,
  expenses: httpMoney.expenses,
  chat: {
    listChannels: httpChat.listChannels,
    listMessages: httpChat.listMessages,
    send: httpChat.send,
    subscribe: httpChat.subscribe,
    unreadCount: httpChat.unreadCount,
    firstUnreadId: httpChat.firstUnreadId,
    markRead: httpChat.markRead,
  },
  demo: {
    reset: httpDemo.reset,
  },
}

/** True when the screens are talking to the real backend rather than the in-browser store. */
export const usingBackend =
  import.meta.env.VITE_USE_MOCK === 'false' || import.meta.env.MODE === 'backend'

export const api: Api = usingBackend ? httpApi : mockApi
