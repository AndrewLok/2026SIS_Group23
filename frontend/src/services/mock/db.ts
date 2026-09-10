/*
 * In-memory store standing in for a backend, persisted to localStorage so a
 * refresh keeps your session and your data.
 *
 * Nothing outside src/services/mock touches this. Components go through the api
 * object in src/services/client.ts, which is the only file that changes when a
 * real backend arrives.
 */

import { buildSeed } from '@/services/mock/seed'
import type {
  BookingRow,
  ChannelRow,
  ExpenseRow,
  FuelLegRow,
  IdeaRow,
  MessageRow,
  ProfileRow,
  TripMemberRow,
  TripRow,
  VoteRow,
} from '@/types'

export type Db = {
  profiles: ProfileRow[]
  trips: TripRow[]
  tripMembers: TripMemberRow[]
  ideas: IdeaRow[]
  votes: VoteRow[]
  bookings: BookingRow[]
  fuelLegs: FuelLegRow[]
  expenses: ExpenseRow[]
  channels: ChannelRow[]
  messages: MessageRow[]
  /** Currently signed-in profile id, or null. */
  sessionUserId: string | null
  /**
   * Mock-only credential map, email to password. A real backend never sees this
   * and it must not survive the swap in src/services/client.ts.
   */
  credentials: Record<string, string>
  /** Last time each member opened each channel, for the unread count. */
  channelReads: Record<string, string>
}

const STORAGE_KEY = 'voyager.db.v1'

let db: Db = load()

function load(): Db {
  if (typeof localStorage === 'undefined') return buildSeed()
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      const fresh = buildSeed()
      persist(fresh)
      return fresh
    }
    return JSON.parse(raw) as Db
  } catch {
    const fresh = buildSeed()
    persist(fresh)
    return fresh
  }
}

function persist(next: Db): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // A full or unavailable localStorage should not break the app; the store
    // simply stops surviving refreshes.
  }
}

/** Read the current store. Treat the result as immutable. */
export const read = (): Db => db

/** Apply a mutation and persist it. */
export function write<T>(mutator: (draft: Db) => T): T {
  const result = mutator(db)
  persist(db)
  return result
}

/** Throw away everything and reseed. Used by the "reset demo data" action. */
export function reset(): void {
  db = buildSeed()
  persist(db)
}

export const uid = (): string => crypto.randomUUID()

/** Six uppercase characters, avoiding the glyphs people misread aloud. */
export function inviteCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)]
  }
  return code
}

/**
 * Every mock method waits a little, so loading states get exercised during
 * development instead of only appearing once a real network is involved.
 */
export const latency = (): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, 150 + Math.random() * 250))
