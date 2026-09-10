/*
 * Demo data. Written to look like a real trip so the screens can be judged
 * honestly, but it is fiction: no person, booking, reference or figure here
 * corresponds to anything real, and the UI says so where a visitor could
 * mistake it for real activity.
 *
 * Ids are readable and fixed rather than random. Split remainders are allocated
 * in id order, so stable ids keep every balance reproducible and hand-checkable.
 */

import type { Db } from '@/services/mock/db'

const DAY = 24 * 60 * 60 * 1000

/** An ISO timestamp n days from now, at the given local time. */
function at(dayOffset: number, hour = 9, minute = 0): string {
  const d = new Date(Date.now() + dayOffset * DAY)
  d.setHours(hour, minute, 0, 0)
  return d.toISOString()
}

/** Trip starts far enough out that the countdown is the interesting number. */
const TRIP_START_OFFSET = 18
const TRIP_LENGTH = 7

const ETHAN = 'usr-ethan'
const JONAS = 'usr-jonas'
const LACHLAN = 'usr-lachlan'
const MIA = 'usr-mia'
const PRIYA = 'usr-priya'

/** The account the "try the demo trip" button signs in as. */
export const DEMO_EMAIL = 'lachlan@example.com'
export const DEMO_PASSWORD = 'roadtrip'
export const DEMO_USER_ID = LACHLAN

const TRIP = 'trip-gor'
const CHANNEL = 'chan-general'

export function buildSeed(): Db {
  const startYear = new Date(Date.now() + TRIP_START_OFFSET * DAY).getFullYear()

  return {
    sessionUserId: null,

    credentials: {
      [DEMO_EMAIL]: DEMO_PASSWORD,
      'priya@example.com': 'roadtrip',
      'ethan@example.com': 'roadtrip',
      'mia@example.com': 'roadtrip',
      'jonas@example.com': 'roadtrip',
    },

    channelReads: {},

    profiles: [
      { id: LACHLAN, display_name: 'Lachlan Fawle', email: DEMO_EMAIL, avatar_hue: 142 },
      { id: PRIYA, display_name: 'Priya Raman', email: 'priya@example.com', avatar_hue: 28 },
      { id: ETHAN, display_name: 'Ethan Brand', email: 'ethan@example.com', avatar_hue: 205 },
      { id: MIA, display_name: 'Mia Okafor', email: 'mia@example.com', avatar_hue: 315 },
      { id: JONAS, display_name: 'Jonas Vidal', email: 'jonas@example.com', avatar_hue: 55 },
    ],

    trips: [
      {
        id: TRIP,
        name: `Great Ocean Road ${startYear}`,
        destination: 'Victoria, Australia',
        start_date: at(TRIP_START_OFFSET, 7, 0),
        end_date: at(TRIP_START_OFFSET + TRIP_LENGTH, 18, 0),
        invite_code: 'GOR27X',
        created_by: LACHLAN,
        currency: 'AUD',
        cover_hue: 142,
        allowance_cents: 25_000,
        default_efficiency: 8.0,
        default_price_per_litre_cents: 195,
        private_debts: true,
      },
    ],

    tripMembers: [
      { trip_id: TRIP, user_id: LACHLAN, role: 'owner', joined_at: at(-40) },
      { trip_id: TRIP, user_id: PRIYA, role: 'member', joined_at: at(-39) },
      { trip_id: TRIP, user_id: ETHAN, role: 'member', joined_at: at(-38) },
      { trip_id: TRIP, user_id: MIA, role: 'member', joined_at: at(-36) },
      { trip_id: TRIP, user_id: JONAS, role: 'member', joined_at: at(-31) },
    ],

    ideas: [
      {
        id: 'idea-apostles',
        trip_id: TRIP,
        title: 'Twelve Apostles at sunrise',
        description: 'Leave Apollo Bay at 05:30 to get there before the tour buses.',
        category: 'activity',
        proposed_start: at(TRIP_START_OFFSET + 2, 6, 15),
        proposed_end: at(TRIP_START_OFFSET + 2, 8, 30),
        all_day: false,
        status: 'agreed',
        proposed_by: PRIYA,
        created_at: at(-30),
      },
      {
        id: 'idea-otway',
        trip_id: TRIP,
        title: 'Otway rainforest walk',
        description: 'Maits Rest, about an hour on the boardwalk. Easy on tired legs.',
        category: 'activity',
        proposed_start: at(TRIP_START_OFFSET + 3, 10, 0),
        proposed_end: at(TRIP_START_OFFSET + 3, 12, 0),
        all_day: false,
        status: 'agreed',
        proposed_by: ETHAN,
        created_at: at(-28),
      },
      {
        id: 'idea-fishnchips',
        trip_id: TRIP,
        title: 'Fish and chips on the Apollo Bay foreshore',
        description: 'Cheap night. Everyone gets their own, no splitting a share plate.',
        category: 'food',
        proposed_start: at(TRIP_START_OFFSET + 2, 18, 30),
        proposed_end: at(TRIP_START_OFFSET + 2, 20, 0),
        all_day: false,
        status: 'agreed',
        proposed_by: MIA,
        created_at: at(-25),
      },
      {
        id: 'idea-lorne-house',
        trip_id: TRIP,
        title: 'Split a house in Lorne for two nights',
        description: 'Cheaper per head than two motel rooms once there are five of us.',
        category: 'stay',
        proposed_start: null,
        proposed_end: null,
        all_day: false,
        status: 'agreed',
        proposed_by: LACHLAN,
        created_at: at(-24),
      },
      {
        id: 'idea-kayak',
        trip_id: TRIP,
        title: 'Kayak out to the seal colony',
        description: 'Two hours from Marengo. Needs at least four people to book.',
        category: 'activity',
        proposed_start: at(TRIP_START_OFFSET + 4, 9, 0),
        proposed_end: at(TRIP_START_OFFSET + 4, 11, 0),
        all_day: false,
        status: 'voting',
        proposed_by: JONAS,
        created_at: at(-12),
      },
      {
        id: 'idea-winery',
        trip_id: TRIP,
        title: 'Long lunch at a Bellarine winery',
        description: 'Would need a nominated driver, which nobody has volunteered for.',
        category: 'food',
        proposed_start: at(TRIP_START_OFFSET + 5, 12, 30),
        proposed_end: at(TRIP_START_OFFSET + 5, 15, 30),
        all_day: false,
        status: 'voting',
        proposed_by: PRIYA,
        created_at: at(-9),
      },
      {
        id: 'idea-surf',
        trip_id: TRIP,
        title: 'Beginner surf lesson at Torquay',
        description: 'Boards and wetsuits included. Mia and Jonas have never surfed.',
        category: 'activity',
        proposed_start: null,
        proposed_end: null,
        all_day: false,
        status: 'voting',
        proposed_by: MIA,
        created_at: at(-6),
      },
      {
        id: 'idea-skydive',
        trip_id: TRIP,
        title: 'Skydive over Barwon Heads',
        description: 'Four hundred each and half the group said absolutely not.',
        category: 'activity',
        proposed_start: null,
        proposed_end: null,
        all_day: false,
        status: 'rejected',
        proposed_by: JONAS,
        created_at: at(-20),
      },
    ],

    votes: [
      // Apostles: agreed, 5 of 5.
      { idea_id: 'idea-apostles', user_id: PRIYA, value: 1, created_at: at(-30) },
      { idea_id: 'idea-apostles', user_id: LACHLAN, value: 1, created_at: at(-30) },
      { idea_id: 'idea-apostles', user_id: ETHAN, value: 1, created_at: at(-29) },
      { idea_id: 'idea-apostles', user_id: MIA, value: 1, created_at: at(-29) },
      { idea_id: 'idea-apostles', user_id: JONAS, value: 1, created_at: at(-28) },

      // Otway: agreed, 4 for, 1 against.
      { idea_id: 'idea-otway', user_id: ETHAN, value: 1, created_at: at(-28) },
      { idea_id: 'idea-otway', user_id: LACHLAN, value: 1, created_at: at(-27) },
      { idea_id: 'idea-otway', user_id: MIA, value: 1, created_at: at(-27) },
      { idea_id: 'idea-otway', user_id: PRIYA, value: 1, created_at: at(-26) },
      { idea_id: 'idea-otway', user_id: JONAS, value: -1, created_at: at(-26) },

      // Fish and chips: agreed, 4 for.
      { idea_id: 'idea-fishnchips', user_id: MIA, value: 1, created_at: at(-25) },
      { idea_id: 'idea-fishnchips', user_id: JONAS, value: 1, created_at: at(-24) },
      { idea_id: 'idea-fishnchips', user_id: ETHAN, value: 1, created_at: at(-24) },
      { idea_id: 'idea-fishnchips', user_id: LACHLAN, value: 1, created_at: at(-23) },

      // Lorne house: agreed, 3 for, but still has no dates.
      { idea_id: 'idea-lorne-house', user_id: LACHLAN, value: 1, created_at: at(-24) },
      { idea_id: 'idea-lorne-house', user_id: PRIYA, value: 1, created_at: at(-23) },
      { idea_id: 'idea-lorne-house', user_id: MIA, value: 1, created_at: at(-22) },

      // Kayak: 2 for, one short of the line.
      { idea_id: 'idea-kayak', user_id: JONAS, value: 1, created_at: at(-12) },
      { idea_id: 'idea-kayak', user_id: ETHAN, value: 1, created_at: at(-11) },

      // Winery: split.
      { idea_id: 'idea-winery', user_id: PRIYA, value: 1, created_at: at(-9) },
      { idea_id: 'idea-winery', user_id: MIA, value: 1, created_at: at(-8) },
      { idea_id: 'idea-winery', user_id: ETHAN, value: -1, created_at: at(-8) },
      { idea_id: 'idea-winery', user_id: JONAS, value: -1, created_at: at(-7) },

      // Surf: one vote so far.
      { idea_id: 'idea-surf', user_id: MIA, value: 1, created_at: at(-6) },

      // Skydive: rejected outright.
      { idea_id: 'idea-skydive', user_id: JONAS, value: 1, created_at: at(-20) },
      { idea_id: 'idea-skydive', user_id: PRIYA, value: -1, created_at: at(-19) },
      { idea_id: 'idea-skydive', user_id: MIA, value: -1, created_at: at(-19) },
      { idea_id: 'idea-skydive', user_id: LACHLAN, value: -1, created_at: at(-18) },
    ],

    bookings: [
      {
        id: 'bk-house-lorne',
        trip_id: TRIP,
        type: 'stay',
        title: 'Beach house, Lorne',
        provider: 'Great Ocean Stays',
        reference: 'GOS-44192',
        starts_at: at(TRIP_START_OFFSET, 15, 0),
        ends_at: at(TRIP_START_OFFSET + 2, 10, 0),
        origin: '',
        destination: '18 Mountjoy Parade, Lorne',
        cost_cents: 96_000,
        belongs_to: null,
        notes: 'Three bedrooms, sofa bed in the lounge. Key in the lockbox, code sent the day before.',
      },
      {
        id: 'bk-apollo-motel',
        trip_id: TRIP,
        type: 'stay',
        title: 'Apollo Bay motel, two rooms',
        provider: 'Bayside Motor Inn',
        reference: 'BMI-77310',
        starts_at: at(TRIP_START_OFFSET + 2, 14, 0),
        ends_at: at(TRIP_START_OFFSET + 4, 10, 0),
        origin: '',
        destination: 'Apollo Bay',
        cost_cents: 64_000,
        belongs_to: null,
        notes: '',
      },
      {
        id: 'bk-jonas-flight',
        trip_id: TRIP,
        type: 'flight',
        title: 'JQ 610 BNE to MEL',
        provider: 'Jetstar',
        reference: 'K4RT2W',
        starts_at: at(TRIP_START_OFFSET - 1, 6, 20),
        ends_at: at(TRIP_START_OFFSET - 1, 9, 5),
        origin: 'BNE',
        destination: 'MEL',
        cost_cents: 21_900,
        belongs_to: JONAS,
        notes: 'Jonas is flying down the night before and staying with his cousin.',
      },
      {
        id: 'bk-van',
        trip_id: TRIP,
        type: 'car',
        title: '8-seat van, 8 days',
        provider: 'Melbourne Van Hire',
        reference: 'MVH-2208841',
        starts_at: at(TRIP_START_OFFSET, 8, 0),
        ends_at: at(TRIP_START_OFFSET + TRIP_LENGTH, 17, 0),
        origin: 'Melbourne Airport',
        destination: 'Melbourne Airport',
        cost_cents: 78_500,
        belongs_to: null,
        notes: 'Lachlan and Priya are both on the licence. Excess reduction included.',
      },
    ],

    fuelLegs: [
      {
        id: 'fuel-mel-lorne',
        trip_id: TRIP,
        label: 'Melbourne to Lorne',
        distance_km: 141,
        efficiency_l_100km: 9.4,
        price_per_litre_cents: 198,
        driver_id: LACHLAN,
        rider_ids: [LACHLAN, PRIYA, ETHAN, MIA, JONAS],
        created_at: at(-5),
      },
      {
        id: 'fuel-lorne-apollo',
        trip_id: TRIP,
        label: 'Lorne to Apollo Bay',
        distance_km: 45,
        efficiency_l_100km: 9.4,
        price_per_litre_cents: 212,
        driver_id: PRIYA,
        rider_ids: [LACHLAN, PRIYA, ETHAN, MIA, JONAS],
        created_at: at(-4),
      },
      {
        id: 'fuel-apollo-portcampbell',
        trip_id: TRIP,
        label: 'Apollo Bay to Port Campbell and back',
        distance_km: 190,
        efficiency_l_100km: 9.4,
        price_per_litre_cents: 205,
        driver_id: ETHAN,
        // Mia and Jonas stayed behind, so this one splits three ways.
        rider_ids: [LACHLAN, ETHAN, PRIYA],
        created_at: at(-3),
      },
    ],

    expenses: [
      {
        id: 'exp-house-deposit',
        trip_id: TRIP,
        description: 'Lorne house deposit',
        amount_cents: 48_000,
        paid_by: PRIYA,
        spent_at: at(-26, 19, 0),
        category: 'stay',
        source: 'manual',
        source_id: null,
      },
      {
        id: 'exp-house-balance',
        trip_id: TRIP,
        description: 'Lorne house balance',
        amount_cents: 48_000,
        paid_by: PRIYA,
        spent_at: at(-6, 9, 30),
        category: 'stay',
        source: 'manual',
        source_id: null,
      },
      {
        id: 'exp-motel',
        trip_id: TRIP,
        description: 'Apollo Bay motel, both rooms',
        amount_cents: 64_000,
        paid_by: MIA,
        spent_at: at(-21, 11, 0),
        category: 'stay',
        source: 'manual',
        source_id: null,
      },
      {
        id: 'exp-van',
        trip_id: TRIP,
        description: 'Van hire, paid up front',
        amount_cents: 78_500,
        paid_by: LACHLAN,
        spent_at: at(-19, 16, 45),
        category: 'transport',
        source: 'manual',
        source_id: null,
      },
      {
        id: 'exp-esky',
        trip_id: TRIP,
        description: 'Esky, camp chairs and a gas bottle',
        amount_cents: 13_450,
        paid_by: ETHAN,
        spent_at: at(-11, 14, 20),
        category: 'other',
        source: 'manual',
        source_id: null,
      },
      {
        id: 'exp-groceries-1',
        trip_id: TRIP,
        description: 'First big grocery shop',
        amount_cents: 21_780,
        paid_by: MIA,
        spent_at: at(-2, 17, 10),
        category: 'food',
        source: 'manual',
        source_id: null,
      },
      {
        id: 'exp-kayak-deposit',
        trip_id: TRIP,
        description: 'Kayak tour deposit, refundable',
        amount_cents: 8_000,
        paid_by: JONAS,
        spent_at: at(-10, 20, 0),
        category: 'tickets',
        source: 'manual',
        source_id: null,
      },
      {
        id: 'exp-parkpass',
        trip_id: TRIP,
        description: 'Otway parks day passes',
        amount_cents: 6_500,
        paid_by: ETHAN,
        spent_at: at(-7, 12, 0),
        category: 'tickets',
        source: 'manual',
        source_id: null,
      },
      {
        id: 'exp-coffee',
        trip_id: TRIP,
        description: 'Coffees and pies at the servo',
        amount_cents: 4_260,
        paid_by: PRIYA,
        spent_at: at(-1, 8, 40),
        category: 'food',
        source: 'manual',
        source_id: null,
      },
      // Three fuel-sourced expenses, written through from the legs above.
      // These split across riders only, which is why the fuel leg carries its
      // own rider list rather than reusing the member list.
      {
        id: 'exp-fuel-mel-lorne',
        trip_id: TRIP,
        description: 'Fuel: Melbourne to Lorne',
        amount_cents: 2_624,
        paid_by: LACHLAN,
        spent_at: at(-5, 10, 0),
        category: 'transport',
        source: 'fuel',
        source_id: 'fuel-mel-lorne',
      },
      {
        id: 'exp-fuel-lorne-apollo',
        trip_id: TRIP,
        description: 'Fuel: Lorne to Apollo Bay',
        amount_cents: 897,
        paid_by: PRIYA,
        spent_at: at(-4, 15, 30),
        category: 'transport',
        source: 'fuel',
        source_id: 'fuel-lorne-apollo',
      },
      {
        id: 'exp-fuel-apollo-pc',
        trip_id: TRIP,
        description: 'Fuel: Apollo Bay to Port Campbell and back',
        amount_cents: 3_661,
        paid_by: ETHAN,
        spent_at: at(-3, 18, 15),
        category: 'transport',
        source: 'fuel',
        source_id: 'fuel-apollo-portcampbell',
      },
    ],

    channels: [{ id: CHANNEL, trip_id: TRIP, name: 'general' }],

    messages: [
      { id: 'msg-01', channel_id: CHANNEL, author_id: LACHLAN, body: 'Right, van is booked. Eight seats so nobody has to sit on the esky.', created_at: at(-19, 16, 50) },
      { id: 'msg-02', channel_id: CHANNEL, author_id: PRIYA, body: 'Legend. I put the house deposit down too.', created_at: at(-19, 17, 2) },
      { id: 'msg-03', channel_id: CHANNEL, author_id: PRIYA, body: 'Can everyone check the dates on the booking before I pay the rest', created_at: at(-19, 17, 3) },
      { id: 'msg-04', channel_id: CHANNEL, author_id: ETHAN, body: 'Dates look right to me', created_at: at(-19, 18, 22) },
      { id: 'msg-05', channel_id: CHANNEL, author_id: MIA, body: 'Same. Motel in Apollo Bay is sorted for the two nights after.', created_at: at(-18, 9, 15) },
      { id: 'msg-06', channel_id: CHANNEL, author_id: JONAS, body: 'I am flying in the night before, will meet you at the airport in the morning', created_at: at(-18, 20, 40) },
      { id: 'msg-07', channel_id: CHANNEL, author_id: JONAS, body: 'Also I still think the skydive was a good idea', created_at: at(-18, 20, 41) },
      { id: 'msg-08', channel_id: CHANNEL, author_id: MIA, body: 'It was four hundred dollars Jonas', created_at: at(-18, 20, 44) },
      { id: 'msg-09', channel_id: CHANNEL, author_id: ETHAN, body: 'Outvoted mate', created_at: at(-18, 21, 1) },
      { id: 'msg-10', channel_id: CHANNEL, author_id: LACHLAN, body: 'Sunrise at the Apostles is locked in. We leave Apollo Bay at half five.', created_at: at(-12, 8, 30) },
      { id: 'msg-11', channel_id: CHANNEL, author_id: MIA, body: 'Half five in the morning?', created_at: at(-12, 8, 33) },
      { id: 'msg-12', channel_id: CHANNEL, author_id: PRIYA, body: 'That is the whole point of going at sunrise', created_at: at(-12, 8, 35) },
      { id: 'msg-13', channel_id: CHANNEL, author_id: MIA, body: 'Fine. Someone else is driving though.', created_at: at(-12, 8, 36) },
      { id: 'msg-14', channel_id: CHANNEL, author_id: ETHAN, body: 'Got the park passes and a few camp chairs. Put them both in the app.', created_at: at(-7, 12, 10) },
      { id: 'msg-15', channel_id: CHANNEL, author_id: JONAS, body: 'Kayak place wants four minimum, we have two votes so far', created_at: at(-6, 19, 20) },
      { id: 'msg-16', channel_id: CHANNEL, author_id: LACHLAN, body: 'Have a look at the voting tab everyone, a few things still need calling', created_at: at(-5, 9, 5) },
      { id: 'msg-17', channel_id: CHANNEL, author_id: PRIYA, body: 'Paid the house balance this morning so that is fully settled now', created_at: at(-5, 9, 40) },
      { id: 'msg-18', channel_id: CHANNEL, author_id: MIA, body: 'Did the big shop. Receipt is in the expenses.', created_at: at(-2, 17, 15) },
      { id: 'msg-19', channel_id: CHANNEL, author_id: ETHAN, body: 'Anyone want anything from Torquay on the way through', created_at: at(-1, 7, 50) },
      { id: 'msg-20', channel_id: CHANNEL, author_id: JONAS, body: 'Coffee. Large.', created_at: at(-1, 7, 55) },
    ],
  }
}
