import { expect } from '@playwright/test'
import type { Browser, BrowserContext, BrowserContextOptions, Locator, Page } from '@playwright/test'

/*
 * Shared steps for the end-to-end tests.
 *
 * Each person gets their own browser context, which means their own cookie jar: the same as
 * separate people on separate phones. Emails are unique per call, because the backend's database
 * is shared by every test in the run (and by earlier runs, if a backend was left running).
 */

export const PASSWORD = 'hunter22'

/** The invite code alphabet: six characters, no 0, 1, I or O. */
export const CODE_PATTERN = /^[A-HJ-NP-Z2-9]{6}$/

export type Person = {
  name: string
  email: string
  context: BrowserContext
  page: Page
}

export type Trip = {
  /** Path of the trip overview, e.g. /trips/3f2a... */
  path: string
  name: string
  code: string
}

let counter = 0

export function uniqueEmail(name: string): string {
  counter += 1
  const slug = name.toLowerCase().replace(/[^a-z]+/g, '')
  return `${slug}-${Date.now()}-${counter}-${Math.random().toString(36).slice(2, 7)}@example.com`
}

/** Open the sign-up form, fill it in and submit. Leaves the page wherever the app sends it. */
export async function fillSignUp(page: Page, name: string, email: string, password = PASSWORD): Promise<void> {
  await page.goto('/login')
  await page.getByRole('button', { name: 'Create one' }).click()
  await page.getByLabel('Display name').fill(name)
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Create account' }).click()
}

/**
 * A new person with their own browser, signed up and sitting on their (empty) trip list. The
 * options are for a browser that differs from the default, such as one in another time zone.
 */
export async function newPerson(
  browser: Browser,
  name: string,
  options: BrowserContextOptions = {},
): Promise<Person> {
  const context = await browser.newContext(options)
  const page = await context.newPage()
  const email = uniqueEmail(name)
  await fillSignUp(page, name, email)
  await expect(page).toHaveURL(/\/trips$/)
  await expect(page.getByText(`Signed in as ${name}`)).toBeVisible()
  return { name, email, context, page }
}

/** The owner makes a trip from the trips page and ends up on its overview. */
export async function createTrip(owner: Person, name: string, destination = 'Victoria'): Promise<Trip> {
  const { page } = owner
  await page.goto('/trips')
  await page.getByRole('button', { name: 'New trip' }).click()
  await page.getByLabel('Trip name').fill(name)
  await page.getByLabel('Destination').fill(destination)
  await page.getByLabel('Starts').fill('2026-11-08')
  await page.getByLabel('Ends').fill('2026-11-15')
  await page.getByRole('button', { name: 'Create trip' }).click()

  await expect(page).toHaveURL(/\/trips\/[0-9a-f-]{36}$/)
  const path = new URL(page.url()).pathname
  const code = await readInviteCode(owner, path)
  return { path, name, code }
}

/** The members page is where the invite code lives. */
export async function readInviteCode(person: Person, tripPath: string): Promise<string> {
  await person.page.goto(`${tripPath}/members`)
  const code = person.page.locator('p.select-all')
  await expect(code).toHaveText(CODE_PATTERN)
  return (await code.innerText()).trim()
}

/** Follow an invite link, look at the preview, and join. */
export async function joinByLink(person: Person, code: string): Promise<void> {
  await person.page.goto(`/join/${code}`)
  await person.page.getByRole('button', { name: 'Join this trip' }).click()
  await expect(person.page).toHaveURL(/\/trips\/[0-9a-f-]{36}$/)
}

/** One person's row on the members page. (Their name appears twice inside it, so match the row.) */
export function memberRow(page: Page, name: string): Locator {
  return page.getByRole('listitem').filter({ hasText: name })
}

/** Open the trip's chat screen and wait until the message box is there. */
export async function openChat(person: Person, tripPath: string): Promise<void> {
  await person.page.goto(`${tripPath}/chat`)
  await expect(person.page.getByLabel('Message')).toBeVisible()
}

/** Type a message into the open chat screen and send it with Enter. */
export async function say(person: Person, text: string): Promise<void> {
  const box = person.page.getByLabel('Message')
  await box.fill(text)
  await box.press('Enter')
  await expect(box).toHaveValue('')
}

/* Activities */

/** An activity's title on the page. (The text also sits in the hidden label of its delete button.) */
export const titled = (page: Page, title: string): Locator => page.getByRole('heading', { name: title })

/** Open the trip's Activities screen and wait until it has loaded. */
export async function openActivities(person: Person, tripPath: string): Promise<void> {
  await person.page.goto(`${tripPath}/activities`)
  await expect(person.page.getByRole('heading', { name: 'Activities' })).toBeVisible()
}

export const activityTab = (page: Page, name: 'Plan' | 'Voting' | 'Ruled out'): Locator =>
  page.getByRole('tab', { name: new RegExp(`^${name}`) })

/**
 * Fill in the "Add an activity" drawer on the open Activities screen and submit it. Straight to the
 * plan needs a time; putting it to a vote may have one or not.
 */
export async function addActivity(
  person: Person,
  title: string,
  how: { vote: true; when?: string } | { vote?: false; when: string },
): Promise<void> {
  const { page } = person
  await page.getByRole('button', { name: 'Add activity' }).click()
  if (how.vote) await page.getByRole('radio', { name: 'Put it to a vote' }).click()
  await page.getByLabel('What is it').fill(title)
  if (how.when) await page.getByLabel('When').fill(how.when)
  await page.getByRole('button', { name: how.vote ? 'Put it to a vote' : 'Add to the plan' }).click()
  await expect(page.getByText(how.vote ? 'Put to a vote.' : 'Added to the plan.')).toBeVisible()
}

/* Bookings */

/** Open the trip's Bookings screen and wait until it has loaded. */
export async function openBookings(person: Person, tripPath: string): Promise<void> {
  await person.page.goto(`${tripPath}/bookings`)
  await expect(person.page.getByRole('heading', { name: 'Bookings' })).toBeVisible()
}

/** A booking's card on the page. (Its title also sits in the hidden label of its delete button.) */
export const bookingCard = (page: Page, title: string): Locator =>
  page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: title }) })

/**
 * Fill in the "Add a booking" drawer on the open Bookings screen and submit it. The type is left at
 * its default, a flight, so the title field is called "Flight number".
 */
export async function addBooking(
  person: Person,
  title: string,
  options: { departs?: string; arrives?: string; whose?: string } = {},
): Promise<void> {
  const { page } = person
  await page.getByRole('button', { name: 'Add booking' }).click()
  await page.getByLabel('Flight number').fill(title)
  if (options.departs) await page.getByLabel('Departs').fill(options.departs)
  if (options.arrives) await page.getByLabel('Arrives').fill(options.arrives)
  if (options.whose) {
    await page.getByRole('combobox', { name: 'Whose booking' }).click()
    await page.getByRole('option', { name: options.whose }).click()
  }
  await page.getByRole('button', { name: 'Save booking' }).click()
}

/* Money */

/** Open the trip's Money screen and wait until it has loaded. */
export async function openExpenses(person: Person, tripPath: string): Promise<void> {
  await person.page.goto(`${tripPath}/expenses`)
  await expect(person.page.getByRole('heading', { name: 'Money' })).toBeVisible()
}

/** An expense's row in the log. (Its description also sits in the hidden label of its delete button.) */
export const expenseRow = (page: Page, description: string): Locator =>
  page.getByRole('listitem').filter({ hasText: description })

/**
 * Fill in the "Add an expense" drawer on the open Money screen and submit it. `amount` is what
 * would be typed, like "90" or "42.50". It is split equally between everyone unless `owed` is given,
 * which switches to exact amounts: what each named person owes, by display name.
 */
export async function addExpense(
  person: Person,
  description: string,
  amount: string,
  options: { owed?: Record<string, string>; submit?: boolean } = {},
): Promise<void> {
  const { page } = person
  await page.getByRole('button', { name: 'Add expense' }).first().click()
  const drawer = page.getByRole('dialog')
  await drawer.getByLabel('What was it').fill(description)
  await drawer.getByLabel('Amount').fill(amount)
  if (options.owed) {
    await drawer.getByRole('radio', { name: 'Exact amounts' }).click()
    for (const [name, cents] of Object.entries(options.owed)) {
      await drawer.getByLabel(name).fill(cents)
    }
  }
  if (options.submit !== false) {
    await drawer.getByRole('button', { name: 'Add expense' }).click()
  }
}

/* Fuel */

/** Open the trip's Fuel screen and wait until it has loaded. */
export async function openFuel(person: Person, tripPath: string): Promise<void> {
  await person.page.goto(`${tripPath}/fuel`)
  await expect(person.page.getByRole('heading', { name: 'Fuel and travel' })).toBeVisible()
}

/** A leg's card on the page. (Its label also sits in the hidden label of its delete button.) */
export const legCard = (page: Page, label: string): Locator =>
  page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: label }) })

/**
 * Fill in the "Add a fuel leg" drawer on the open Fuel screen and submit it. Everyone is chipping in
 * and the person adding it is the driver, unless `leaveOut` names people to untick (by display name)
 * or `driver` names someone else. The form starts with the trip's last efficiency and price, and
 * both are typed over here so a test does not depend on them.
 */
export async function addLeg(
  person: Person,
  label: string,
  figures: { km: string; efficiency: string; cents: string },
  options: { driver?: string; leaveOut?: string[]; submit?: boolean } = {},
): Promise<void> {
  const { page } = person
  await page.getByRole('button', { name: 'Add a leg' }).click()
  const drawer = page.getByRole('dialog')
  await drawer.getByLabel(/^Leg( \*)?$/).fill(label)
  await drawer.getByLabel('Distance km').fill(figures.km)
  await drawer.getByLabel('L/100km').fill(figures.efficiency)
  await drawer.getByLabel('Cents/L').fill(figures.cents)
  if (options.driver) {
    await drawer.getByRole('combobox', { name: 'Driver' }).click()
    await page.getByRole('option', { name: options.driver }).click()
  }
  for (const name of options.leaveOut ?? []) {
    await drawer.getByRole('checkbox', { name: new RegExp(name) }).click()
  }
  if (options.submit !== false) {
    await drawer.getByRole('button', { name: 'Add leg and charge riders' }).click()
  }
}

export async function closeAll(...people: Person[]): Promise<void> {
  await Promise.all(people.map((p) => p.context.close()))
}
