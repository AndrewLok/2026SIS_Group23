import { readFile } from 'node:fs/promises'
import { expect, request as playwrightRequest, test } from '@playwright/test'
import { addActivity, closeAll, createTrip, joinByLink, newPerson, openActivities } from './helpers.ts'

/*
 * Taking the trip's calendar into another calendar app: the subscription link and the download.
 * A calendar app fetches the link by itself and cannot send the login cookie, so the link is read
 * here with a client that has no cookies at all, the way an app would.
 */

test.describe.configure({ timeout: 60_000 })

const WHEN = '2030-06-15T12:30'
const LINK = /\/api\/calendar\/feeds\/[A-Za-z0-9_-]{43}\.ics$/

test.describe('calendar export', () => {
  test('the link works for a calendar app with no login, a new link replaces it, and the download is a calendar file', async ({ browser }) => {
    const priya = await newPerson(browser, 'Priya Nair')
    const jonas = await newPerson(browser, 'Jonas Weber')
    const trip = await createTrip(priya, 'Great Ocean Road')
    await joinByLink(jonas, trip.code)
    await openActivities(priya, trip.path)
    await addActivity(priya, 'Sunrise swim', { when: WHEN })

    const app = await playwrightRequest.newContext()

    await priya.page.goto(`${trip.path}/calendar`)
    await priya.page.getByRole('button', { name: 'Add to my calendar' }).click()
    const sheet = priya.page.getByRole('dialog')
    const field = sheet.getByLabel('Calendar link')
    await expect(field).toHaveValue(LINK)
    const first = await field.inputValue()

    // An address on this computer cannot work for an online calendar, and the panel says so.
    await expect(sheet.getByText(/only reachable from this computer/)).toBeVisible()
    await expect(sheet.getByRole('link', { name: 'Google Calendar' })).toHaveAttribute('href', /calendar\.google\.com/)
    await expect(sheet.getByRole('link', { name: 'Apple Calendar or Outlook' })).toHaveAttribute('href', /^webcal:\/\//)

    // The app reads it with no cookie and gets the plan.
    const feed = await app.get(first)
    expect(feed.ok()).toBe(true)
    expect(feed.headers()['content-type']).toContain('text/calendar')
    const body = await feed.text()
    expect(body).toContain('BEGIN:VCALENDAR')
    expect(body).toContain('SUMMARY:Sunrise swim')
    expect(body).toContain('DTSTART:2030')

    // It is the same link next time, and Jonas has a different one of his own.
    await priya.page.reload()
    await priya.page.getByRole('button', { name: 'Add to my calendar' }).click()
    await expect(priya.page.getByRole('dialog').getByLabel('Calendar link')).toHaveValue(first)
    await jonas.page.goto(`${trip.path}/calendar`)
    await jonas.page.getByRole('button', { name: 'Add to my calendar' }).click()
    const theirs = jonas.page.getByRole('dialog').getByLabel('Calendar link')
    await expect(theirs).toHaveValue(LINK)
    await expect(theirs).not.toHaveValue(first)

    // The download is a file of the same calendar, named after the trip.
    const [download] = await Promise.all([
      priya.page.waitForEvent('download'),
      priya.page.getByRole('dialog').getByRole('button', { name: 'Download .ics' }).click(),
    ])
    expect(download.suggestedFilename()).toBe('voyager-great-ocean-road.ics')
    const saved = await readFile(await download.path(), 'utf8')
    expect(saved).toContain('BEGIN:VCALENDAR')
    expect(saved).toContain('SUMMARY:Sunrise swim')

    // A new link, after asking: the old one stops working and the new one works.
    const dialog = priya.page.getByRole('dialog')
    await dialog.getByRole('button', { name: 'Make a new link' }).click()
    await priya.page.getByRole('alertdialog').getByRole('button', { name: 'Keep the old link' }).click()
    await expect(dialog.getByLabel('Calendar link')).toHaveValue(first) // Changing her mind changes nothing.
    await dialog.getByRole('button', { name: 'Make a new link' }).click()
    await priya.page.getByRole('alertdialog').getByRole('button', { name: 'Make a new link' }).click()
    await expect(priya.page.getByText('New link made. The old one no longer works.')).toBeVisible()
    await expect(dialog.getByLabel('Calendar link')).not.toHaveValue(first)
    const second = await dialog.getByLabel('Calendar link').inputValue()
    expect(second).toMatch(LINK)
    expect((await app.get(first)).status()).toBe(404)
    expect((await app.get(second)).ok()).toBe(true)
    // Jonas's link was not touched.
    expect((await app.get(await theirs.inputValue())).ok()).toBe(true)

    await app.dispose()
    await closeAll(priya, jonas)
  })

  test('a link that was never made is just not found, and the file is only for people on the trip', async ({ browser }) => {
    const priya = await newPerson(browser, 'Priya Nair')
    const sam = await newPerson(browser, 'Sam Okafor')
    const trip = await createTrip(priya, 'Great Ocean Road')
    const tripId = trip.path.split('/').pop()
    const app = await playwrightRequest.newContext({ baseURL: new URL(priya.page.url()).origin })

    expect((await app.get('/api/calendar/feeds/' + 'a'.repeat(43) + '.ics')).status()).toBe(404)
    expect((await app.get('/api/calendar/feeds/short.ics')).status()).toBe(404)
    // The download needs a login, and a stranger's login is no use either.
    expect((await app.get(`/api/trips/${tripId}/calendar.ics`)).status()).toBe(401)
    const asSam = await sam.page.request.get(`/api/trips/${tripId}/calendar.ics`)
    expect(asSam.status()).toBe(404)

    await app.dispose()
    await closeAll(priya, sam)
  })
})
