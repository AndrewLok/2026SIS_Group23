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

export async function closeAll(...people: Person[]): Promise<void> {
  await Promise.all(people.map((p) => p.context.close()))
}
