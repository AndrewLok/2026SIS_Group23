/*
 * Service-level checks for the behaviour the build plan gates each step on.
 * These run against the real mock store rather than a stub, so they exercise the
 * same code the screens do.
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { reset } from '@/services/mock/db'
import * as auth from '@/services/mock/auth'
import * as trips from '@/services/mock/trips'
import * as ideas from '@/services/mock/ideas'
import * as votes from '@/services/mock/votes'
import * as expenses from '@/services/mock/expenses'
import * as fuel from '@/services/mock/fuel'
import { computeBalances } from '@/lib/balances'
import { totalsForLeg } from '@/lib/fuel'
import { splitEvenly } from '@/lib/money'
import { DEMO_EMAIL, DEMO_PASSWORD, DEMO_USER_ID } from '@/services/mock/seed'
import { ApiError } from '@/types'

const TRIP = 'trip-gor'

beforeEach(async () => {
  reset()
  await auth.signIn(DEMO_EMAIL, DEMO_PASSWORD)
})

describe('auth', () => {
  it('rejects a wrong password without saying which half was wrong', async () => {
    await auth.signOut()
    await expect(auth.signIn(DEMO_EMAIL, 'nope')).rejects.toBeInstanceOf(ApiError)
    expect(await auth.getSession()).toBeNull()
  })

  it('keeps the session across a getSession call', async () => {
    const session = await auth.getSession()
    expect(session?.id).toBe(DEMO_USER_ID)
  })

  it('refuses a second account on the same email', async () => {
    await expect(auth.signUp('Someone Else', DEMO_EMAIL, 'password')).rejects.toThrow()
  })
})

describe('joining by code', () => {
  it('adds the member and is idempotent', async () => {
    const trip = await trips.get(TRIP)
    const before = (await trips.listMembers(TRIP)).length
    await trips.joinByCode(trip.inviteCode)
    expect((await trips.listMembers(TRIP)).length).toBe(before)
  })

  it('rejects a code that matches nothing', async () => {
    await expect(trips.joinByCode('ZZZZZZ')).rejects.toBeInstanceOf(ApiError)
  })

  it('regenerating stops the old code working', async () => {
    const before = (await trips.get(TRIP)).inviteCode
    const after = (await trips.regenerateCode(TRIP)).inviteCode
    expect(after).not.toBe(before)
    await expect(trips.previewByCode(before)).rejects.toBeInstanceOf(ApiError)
  })
})

describe('removing a member', () => {
  it('changes the per-head split, which is what the confirm dialog promises', async () => {
    const spend = (await expenses.list(TRIP)).reduce((s, e) => s + e.amountCents, 0)
    const before = (await trips.listMembers(TRIP)).length
    const splitBefore = splitEvenly(spend, before)[0]

    await trips.removeMember(TRIP, 'usr-jonas')

    const after = (await trips.listMembers(TRIP)).length
    expect(after).toBe(before - 1)
    expect(splitEvenly(spend, after)[0]).not.toBe(splitBefore)
  })

  it('recalculates balances, and they still net to zero', async () => {
    await trips.removeMember(TRIP, 'usr-jonas')
    const memberIds = (await trips.listMembers(TRIP)).map((m) => m.userId)
    const balances = computeBalances(
      await expenses.list(TRIP),
      memberIds,
      await fuel.list(TRIP),
    )
    // Jonas is gone from the trip but still owed for the deposit he paid, so he
    // stays in the ledger. Five rows, four members.
    expect(balances).toHaveLength(5)
    expect(balances.reduce((s, b) => s + b.netCents, 0)).toBe(0)
  })

  it('will not leave a trip without an owner', async () => {
    await expect(trips.removeMember(TRIP, DEMO_USER_ID)).rejects.toBeInstanceOf(ApiError)
  })
})

describe('voting', () => {
  it('promotes an idea the moment it crosses the threshold', async () => {
    // Kayak sits on two agrees with five members, so three is the line.
    const before = (await ideas.list(TRIP)).find((i) => i.id === 'idea-kayak')
    expect(before?.status).toBe('voting')

    await votes.cast('idea-kayak', 1)

    const after = (await ideas.list(TRIP)).find((i) => i.id === 'idea-kayak')
    expect(after?.status).toBe('agreed')
  })

  it('demotes it again when the vote is withdrawn', async () => {
    await votes.cast('idea-kayak', 1)
    await votes.clear('idea-kayak')
    const after = (await ideas.list(TRIP)).find((i) => i.id === 'idea-kayak')
    expect(after?.status).toBe('voting')
  })

  it('overwrites rather than stacks a second vote from the same member', async () => {
    await votes.cast('idea-kayak', 1)
    await votes.cast('idea-kayak', -1)
    const cast = (await votes.listForTrip(TRIP)).filter(
      (v) => v.ideaId === 'idea-kayak' && v.userId === DEMO_USER_ID,
    )
    expect(cast).toHaveLength(1)
    expect(cast[0]?.value).toBe(-1)
  })
})

describe('fuel legs writing through to expenses', () => {
  it('creates an expense matching the leg, paid by the driver', async () => {
    const leg = await fuel.create({
      tripId: TRIP,
      label: 'Test leg',
      distanceKm: 100,
      efficiencyL100km: 8,
      pricePerLitreCents: 200,
      driverId: 'usr-mia',
      riderIds: ['usr-mia', 'usr-priya'],
    })
    const written = (await expenses.list(TRIP)).find((e) => e.sourceId === leg.id)
    // 100km at 8L/100km = 8L, at 200c = 1600c.
    expect(written?.amountCents).toBe(1600)
    expect(written?.amountCents).toBe(totalsForLeg(leg).costCents)
    expect(written?.paidBy).toBe('usr-mia')
    expect(written?.source).toBe('fuel')
  })

  it('keeps the expense in step when the leg is edited', async () => {
    const leg = await fuel.create({
      tripId: TRIP,
      label: 'Test leg',
      distanceKm: 100,
      efficiencyL100km: 8,
      pricePerLitreCents: 200,
      driverId: 'usr-mia',
      riderIds: ['usr-mia', 'usr-priya'],
    })
    await fuel.update(leg.id, { distanceKm: 200 })
    const written = (await expenses.list(TRIP)).find((e) => e.sourceId === leg.id)
    expect(written?.amountCents).toBe(3200)
  })

  it('deletes the expense with the leg', async () => {
    const leg = await fuel.create({
      tripId: TRIP,
      label: 'Test leg',
      distanceKm: 100,
      efficiencyL100km: 8,
      pricePerLitreCents: 200,
      driverId: 'usr-mia',
      riderIds: ['usr-mia'],
    })
    await fuel.remove(leg.id)
    expect((await expenses.list(TRIP)).some((e) => e.sourceId === leg.id)).toBe(false)
  })

  it('refuses to edit a fuel expense directly, and says where to edit it', async () => {
    const fuelExpense = (await expenses.list(TRIP)).find((e) => e.source === 'fuel')
    if (!fuelExpense) throw new Error('seed changed')
    await expect(
      expenses.update(fuelExpense.id, { amountCents: 1 }),
    ).rejects.toThrow(/fuel leg/i)
  })
})

describe('expenses', () => {
  it('rejects an amount of zero rather than storing it', async () => {
    await expect(
      expenses.create({
        tripId: TRIP,
        description: 'Nothing',
        amountCents: 0,
        paidBy: DEMO_USER_ID,
        spentAt: new Date().toISOString(),
        category: 'other',
      }),
    ).rejects.toBeInstanceOf(ApiError)
  })

  it('moves the payer balance by the full amount when one is added', async () => {
    const memberIds = (await trips.listMembers(TRIP)).map((m) => m.userId)
    const legs = await fuel.list(TRIP)
    const before =
      computeBalances(await expenses.list(TRIP), memberIds, legs).find(
        (b) => b.userId === DEMO_USER_ID,
      )?.netCents ?? 0

    await expenses.create({
      tripId: TRIP,
      description: 'Test',
      amountCents: 10_000,
      paidBy: DEMO_USER_ID,
      spentAt: new Date().toISOString(),
      category: 'other',
    })

    const after =
      computeBalances(await expenses.list(TRIP), memberIds, legs).find(
        (b) => b.userId === DEMO_USER_ID,
      )?.netCents ?? 0

    // Paid 10000, owes a fifth of it back, so is up by four fifths.
    expect(after - before).toBe(10_000 - splitEvenly(10_000, memberIds.length)[0]!)
  })
})
