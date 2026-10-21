import { expect, test } from '@playwright/test'
import { closeAll, createTrip, joinByLink, newPerson, openChat, say } from './helpers.ts'

/*
 * Group chat across two people's screens, through the real socket. The backend's ChatFlowTests
 * cover who may read and write; these check that it reaches the other person's screen.
 */

// Long enough for a message to cross the socket and be fetched, shorter than the 5 second polling
// fallback, so these checks only pass when the live connection works rather than the slow path.
const LIVE = { timeout: 3_000 }

test.describe('group chat', () => {
  test('a message appears on the other person’s open chat without reloading', async ({ browser }) => {
    const priya = await newPerson(browser, 'Priya Nair')
    const jonas = await newPerson(browser, 'Jonas Weber')
    const trip = await createTrip(priya, 'Great Ocean Road')
    await joinByLink(jonas, trip.code)
    await openChat(priya, trip.path)
    await openChat(jonas, trip.path)

    await say(priya, 'Leaving at eight')
    await expect(jonas.page.getByText('Leaving at eight')).toBeVisible(LIVE)
    await expect(priya.page.getByText('Leaving at eight')).toBeVisible()

    await say(jonas, 'I will bring the snacks')
    await expect(priya.page.getByText('I will bring the snacks')).toBeVisible(LIVE)

    await closeAll(priya, jonas)
  })

  test('the history is kept: a reload, and a person who joins later, both see it', async ({ browser }) => {
    const priya = await newPerson(browser, 'Priya Nair')
    const jonas = await newPerson(browser, 'Jonas Weber')
    const trip = await createTrip(priya, 'Great Ocean Road')
    await openChat(priya, trip.path)
    await say(priya, 'Before you joined')

    await priya.page.reload()
    await expect(priya.page.getByText('Before you joined')).toBeVisible()

    await joinByLink(jonas, trip.code)
    await openChat(jonas, trip.path)
    await expect(jonas.page.getByText('Before you joined')).toBeVisible()

    await closeAll(priya, jonas)
  })

  test('the unread count updates live, and the “New” divider marks where you left off', async ({ browser }) => {
    const priya = await newPerson(browser, 'Priya Nair')
    const jonas = await newPerson(browser, 'Jonas Weber')
    const trip = await createTrip(priya, 'Great Ocean Road')
    await joinByLink(jonas, trip.code)
    // Jonas waits on the overview, where the Chat lamp counts what he has not read.
    await expect(jonas.page.getByRole('link', { name: 'No unread messages. Open chat.' })).toBeVisible()

    await openChat(priya, trip.path)
    await say(priya, 'First one')
    await say(priya, 'Second one')
    await expect(jonas.page.getByRole('link', { name: '2 unread messages. Open chat.' })).toBeVisible(LIVE)

    await jonas.page.getByRole('link', { name: '2 unread messages. Open chat.' }).click()
    await expect(jonas.page.getByText('Second one')).toBeVisible()
    const divider = jonas.page.getByRole('listitem').filter({ hasText: /^New$/ })
    await expect(divider).toBeVisible()
    // The divider sits above the first unread message.
    await expect(divider.locator('xpath=following-sibling::li[1]')).toContainText('First one')

    // Opening the chat marked it read, and that lives on the server: a fresh load shows none.
    await jonas.page.goto(trip.path)
    await expect(jonas.page.getByRole('link', { name: 'No unread messages. Open chat.' })).toBeVisible()

    await closeAll(priya, jonas)
  })

  test('reading on one device clears the count on another', async ({ browser }) => {
    const priya = await newPerson(browser, 'Priya Nair')
    const jonas = await newPerson(browser, 'Jonas Weber')
    const trip = await createTrip(priya, 'Great Ocean Road')
    await joinByLink(jonas, trip.code)

    // The same account on a second phone: a new browser context signed in with the same details.
    const phone = await browser.newContext()
    const phonePage = await phone.newPage()
    await phonePage.goto('/login')
    await phonePage.getByLabel('Email').fill(jonas.email)
    await phonePage.getByLabel('Password').fill('hunter22')
    await phonePage.getByRole('button', { name: 'Sign in' }).click()
    await expect(phonePage).toHaveURL(/\/trips$/)
    await phonePage.goto(trip.path)

    await openChat(priya, trip.path)
    await say(priya, 'Anyone seen the map?')
    await expect(phonePage.getByRole('link', { name: '1 unread message. Open chat.' })).toBeVisible(LIVE)

    await openChat(jonas, trip.path)
    await expect(jonas.page.getByText('Anyone seen the map?')).toBeVisible()

    // The phone was never opened on the chat, but the count follows what Jonas read elsewhere.
    await phonePage.reload()
    await expect(phonePage.getByRole('link', { name: 'No unread messages. Open chat.' })).toBeVisible()

    await phone.close()
    await closeAll(priya, jonas)
  })
})
