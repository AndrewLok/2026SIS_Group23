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
 * (src/services/http/trips.ts), chat (src/services/http/chat.ts) and activities with
 * their votes (src/services/http/ideas.ts and votes.ts), bookings (src/services/http/bookings.ts),
 * expenses (src/services/http/expenses.ts), fuel legs (src/services/http/fuel.ts), and the calendar
 * file and subscription link (src/services/http/calendar.ts, which has no mock side). That is every
 * module, so nothing the real backend serves touches the mock store any more; it is there only for
 * the demo.
 */

import * as httpAuth from '@/services/http/auth'
import * as httpCalendar from '@/services/http/calendar'
import * as httpBookings from '@/services/http/bookings'
import * as httpChat from '@/services/http/chat'
import * as httpExpenses from '@/services/http/expenses'
import * as httpFuel from '@/services/http/fuel'
import * as httpIdeas from '@/services/http/ideas'
import * as httpTrips from '@/services/http/trips'
import * as httpVotes from '@/services/http/votes'
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
  /**
   * Other people change activities, votes, bookings, expenses and fuel legs while a screen is open, and only a real backend has
   * other people, so only then are they read again every few seconds.
   */
  sharedActivities: !useMock,
  /** The calendar file and subscription link are built by the server from the shared activities. */
  calendarExport: !useMock,
}

const needsBackend = (what: string) => (): Promise<never> =>
  Promise.reject(new ApiError('forbidden', `${what} needs the real backend.`))

const auth = useMock ? mockAuth : httpAuth
// Trips and members move together: who is on a trip is what the rest of the app counts.
const trips = useMock ? mockTrips : httpTrips
// Chat is its own module: who is on the trip decides who may read it, and the backend enforces that.
const chat = useMock ? mockChat : httpChat
// Activities and their votes move together: the votes decide which tab an activity is in, and the
// head count they are counted against is the trip's members.
const ideas = useMock ? mockIdeas : httpIdeas
const votes = useMock ? mockVotes : httpVotes
// Bookings are on their own: who they belong to is checked against the trip's members on the server.
const bookings = useMock ? mockBookings : httpBookings
// Expenses and fuel legs are real too. A fuel leg's expense is written by the server with the leg, so
// it turns up in the expenses list like any other.
const expenses = useMock ? mockExpenses : httpExpenses
const fuel = useMock ? mockFuel : httpFuel

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
    list: ideas.list,
    create: ideas.create,
    update: ideas.update,
    setStatus: ideas.setStatus,
    setAttending: ideas.setAttending,
    remove: ideas.remove,
  },
  votes: {
    listForTrip: votes.listForTrip,
    cast: votes.cast,
    clear: votes.clear,
  },
  calendar: {
    feedPath: useMock ? needsBackend('The calendar link') : httpCalendar.feedPath,
    renewFeed: useMock ? needsBackend('The calendar link') : httpCalendar.renewFeed,
    download: useMock ? needsBackend('Downloading the calendar') : httpCalendar.download,
  },
  bookings: {
    list: bookings.list,
    create: bookings.create,
    update: bookings.update,
    remove: bookings.remove,
  },
  fuel: {
    list: fuel.list,
    create: fuel.create,
    update: fuel.update,
    remove: fuel.remove,
  },
  expenses: {
    list: expenses.list,
    create: expenses.create,
    update: expenses.update,
    remove: expenses.remove,
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
