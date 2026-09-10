/*
 * Entity types for the whole app, plus one mapper per entity.
 *
 * The store speaks snake_case (it stands in for a real API); the app speaks
 * camelCase. The mappers are the only place that knows both, so wiring a real
 * backend means editing this file and src/services/client.ts and nothing else.
 *
 * Two rules hold everywhere: ids are strings, and money is integer cents.
 */

export type Role = 'owner' | 'member'
export type IdeaCategory = 'activity' | 'food' | 'stay' | 'travel'
export type IdeaStatus = 'voting' | 'agreed' | 'rejected'
export type BookingType = 'flight' | 'stay' | 'car' | 'other'
export type ExpenseCategory = 'food' | 'transport' | 'tickets' | 'stay' | 'other'
export type ExpenseSource = 'manual' | 'fuel'

export type Profile = {
  id: string
  displayName: string
  email: string
  avatarHue: number
}

export type Trip = {
  id: string
  name: string
  destination: string
  startDate: string | null
  endDate: string | null
  inviteCode: string
  createdBy: string
  currency: string
  coverHue: number
  /** Per-member manual allowance used by the trip cost estimate, in cents. */
  allowanceCents: number
  /** Remembered fuel defaults, so the add-leg form is never empty. */
  defaultEfficiency: number
  defaultPricePerLitreCents: number
  /** Trip setting: hide settlement rows that do not involve the current user. */
  privateDebts: boolean
}

export type TripMember = {
  tripId: string
  userId: string
  role: Role
  joinedAt: string
}

export type Idea = {
  id: string
  tripId: string
  title: string
  description: string
  category: IdeaCategory
  proposedStart: string | null
  proposedEnd: string | null
  allDay: boolean
  status: IdeaStatus
  proposedBy: string
  createdAt: string
}

export type Vote = {
  ideaId: string
  userId: string
  /** 1 agree, -1 disagree. */
  value: 1 | -1
  createdAt: string
}

export type Booking = {
  id: string
  tripId: string
  type: BookingType
  title: string
  provider: string
  reference: string
  startsAt: string | null
  endsAt: string | null
  origin: string
  destination: string
  costCents: number | null
  /** The member whose booking it is; null for a group booking. */
  belongsTo: string | null
  notes: string
}

export type FuelLeg = {
  id: string
  tripId: string
  label: string
  distanceKm: number
  efficiencyL100km: number
  pricePerLitreCents: number
  driverId: string
  riderIds: string[]
  createdAt: string
}

export type Expense = {
  id: string
  tripId: string
  description: string
  amountCents: number
  paidBy: string
  spentAt: string
  category: ExpenseCategory
  source: ExpenseSource
  /** The fuel leg id when source is 'fuel'. */
  sourceId: string | null
}

export type Channel = {
  id: string
  tripId: string
  name: string
}

export type Message = {
  id: string
  channelId: string
  authorId: string
  body: string
  createdAt: string
}

/* Rows as the store holds them. */

export type ProfileRow = {
  id: string
  display_name: string
  email: string
  avatar_hue: number
}

export type TripRow = {
  id: string
  name: string
  destination: string
  start_date: string | null
  end_date: string | null
  invite_code: string
  created_by: string
  currency: string
  cover_hue: number
  allowance_cents: number
  default_efficiency: number
  default_price_per_litre_cents: number
  private_debts: boolean
}

export type TripMemberRow = {
  trip_id: string
  user_id: string
  role: Role
  joined_at: string
}

export type IdeaRow = {
  id: string
  trip_id: string
  title: string
  description: string
  category: IdeaCategory
  proposed_start: string | null
  proposed_end: string | null
  all_day: boolean
  status: IdeaStatus
  proposed_by: string
  created_at: string
}

export type VoteRow = {
  idea_id: string
  user_id: string
  value: 1 | -1
  created_at: string
}

export type BookingRow = {
  id: string
  trip_id: string
  type: BookingType
  title: string
  provider: string
  reference: string
  starts_at: string | null
  ends_at: string | null
  origin: string
  destination: string
  cost_cents: number | null
  belongs_to: string | null
  notes: string
}

export type FuelLegRow = {
  id: string
  trip_id: string
  label: string
  distance_km: number
  efficiency_l_100km: number
  price_per_litre_cents: number
  driver_id: string
  rider_ids: string[]
  created_at: string
}

export type ExpenseRow = {
  id: string
  trip_id: string
  description: string
  amount_cents: number
  paid_by: string
  spent_at: string
  category: ExpenseCategory
  source: ExpenseSource
  source_id: string | null
}

export type ChannelRow = {
  id: string
  trip_id: string
  name: string
}

export type MessageRow = {
  id: string
  channel_id: string
  author_id: string
  body: string
  created_at: string
}

/* Mappers. */

export const toProfile = (r: ProfileRow): Profile => ({
  id: r.id,
  displayName: r.display_name,
  email: r.email,
  avatarHue: r.avatar_hue,
})

export const toTrip = (r: TripRow): Trip => ({
  id: r.id,
  name: r.name,
  destination: r.destination,
  startDate: r.start_date,
  endDate: r.end_date,
  inviteCode: r.invite_code,
  createdBy: r.created_by,
  currency: r.currency,
  coverHue: r.cover_hue,
  allowanceCents: r.allowance_cents,
  defaultEfficiency: r.default_efficiency,
  defaultPricePerLitreCents: r.default_price_per_litre_cents,
  privateDebts: r.private_debts,
})

export const toTripMember = (r: TripMemberRow): TripMember => ({
  tripId: r.trip_id,
  userId: r.user_id,
  role: r.role,
  joinedAt: r.joined_at,
})

export const toIdea = (r: IdeaRow): Idea => ({
  id: r.id,
  tripId: r.trip_id,
  title: r.title,
  description: r.description,
  category: r.category,
  proposedStart: r.proposed_start,
  proposedEnd: r.proposed_end,
  allDay: r.all_day,
  status: r.status,
  proposedBy: r.proposed_by,
  createdAt: r.created_at,
})

export const toVote = (r: VoteRow): Vote => ({
  ideaId: r.idea_id,
  userId: r.user_id,
  value: r.value,
  createdAt: r.created_at,
})

export const toBooking = (r: BookingRow): Booking => ({
  id: r.id,
  tripId: r.trip_id,
  type: r.type,
  title: r.title,
  provider: r.provider,
  reference: r.reference,
  startsAt: r.starts_at,
  endsAt: r.ends_at,
  origin: r.origin,
  destination: r.destination,
  costCents: r.cost_cents,
  belongsTo: r.belongs_to,
  notes: r.notes,
})

export const toFuelLeg = (r: FuelLegRow): FuelLeg => ({
  id: r.id,
  tripId: r.trip_id,
  label: r.label,
  distanceKm: r.distance_km,
  efficiencyL100km: r.efficiency_l_100km,
  pricePerLitreCents: r.price_per_litre_cents,
  driverId: r.driver_id,
  riderIds: [...r.rider_ids],
  createdAt: r.created_at,
})

export const toExpense = (r: ExpenseRow): Expense => ({
  id: r.id,
  tripId: r.trip_id,
  description: r.description,
  amountCents: r.amount_cents,
  paidBy: r.paid_by,
  spentAt: r.spent_at,
  category: r.category,
  source: r.source,
  sourceId: r.source_id,
})

export const toChannel = (r: ChannelRow): Channel => ({
  id: r.id,
  tripId: r.trip_id,
  name: r.name,
})

export const toMessage = (r: MessageRow): Message => ({
  id: r.id,
  channelId: r.channel_id,
  authorId: r.author_id,
  body: r.body,
  createdAt: r.created_at,
})

/** Thrown by every service method so callers branch on a code, not a string. */
export class ApiError extends Error {
  code: 'not_found' | 'invalid_credentials' | 'conflict' | 'forbidden' | 'invalid'

  constructor(code: ApiError['code'], message: string) {
    super(message)
    this.name = 'ApiError'
    this.code = code
  }
}
