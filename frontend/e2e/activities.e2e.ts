import { expect, test } from '@playwright/test'
import {
  activityTab as tab,
  addActivity,
  closeAll,
  createTrip,
  joinByLink,
  newPerson,
  openActivities,
  titled,
} from './helpers.ts'

/*
 * Activities and votes across several people's screens. The detailed rules (who may edit, rule out
 * or delete; how a vote is counted; what happens to a leaver's votes) are checked in the backend's
 * IdeaFlowTests; these check that it reaches the other person's screen and that the screen offers
 * the right things.
 */

// Other people's changes arrive by the screen looking again every five seconds, so give it a little more.
const POLL = { timeout: 12_000 }

test.describe('activities', () => {
  // Several people, each signing up, and some changes only arrive on the next five-second look.
  test.describe.configure({ timeout: 60_000 })

  test('a vote on one screen carries the activity onto the plan on the other', async ({ browser }) => {
    const priya = await newPerson(browser, 'Priya Nair')
    const jonas = await newPerson(browser, 'Jonas Weber')
    const trip = await createTrip(priya, 'Great Ocean Road')
    await joinByLink(jonas, trip.code)

    // Priya puts it to the group and sits on the Voting tab.
    await openActivities(priya, trip.path)
    await addActivity(priya, 'Kayak to the seal colony', { vote: true })
    await tab(priya.page, 'Voting').click()
    await expect(titled(priya.page, 'Kayak to the seal colony')).toBeVisible()
    await expect(priya.page.getByText('1 of 2 needed')).toBeVisible()

    // Jonas sees it without being told, and votes for it. That makes two of two.
    await openActivities(jonas, trip.path)
    await tab(jonas.page, 'Voting').click()
    await expect(titled(jonas.page, 'Kayak to the seal colony')).toBeVisible()
    await jonas.page.getByRole('button', { name: /for$/ }).click()
    await expect(jonas.page.getByText('Nothing waiting on a vote.')).toBeVisible()

    await tab(jonas.page, 'Plan').click()
    await expect(titled(jonas.page, 'Kayak to the seal colony')).toBeVisible()
    await expect(jonas.page.getByText('Voted in by Priya Nair')).toBeVisible()
    await expect(jonas.page.getByText('You and 1 more')).toBeVisible()

    // Priya never touched her screen: it moved by itself, with both of them going.
    await expect(priya.page.getByText('Nothing waiting on a vote.')).toBeVisible(POLL)
    await tab(priya.page, 'Plan').click()
    await expect(priya.page.getByText('Voted in by you')).toBeVisible()
    await expect(priya.page.getByText('You and 1 more')).toBeVisible()

    await closeAll(priya, jonas)
  })

  test('something added straight to the plan: the other person says they are in, then out', async ({ browser }) => {
    const priya = await newPerson(browser, 'Priya Nair')
    const jonas = await newPerson(browser, 'Jonas Weber')
    const trip = await createTrip(priya, 'Great Ocean Road')
    await joinByLink(jonas, trip.code)

    await openActivities(priya, trip.path)
    await addActivity(priya, 'Lunch at the bakery', { when: '2026-11-09T12:30' })
    await expect(titled(priya.page, 'Lunch at the bakery')).toBeVisible()
    await expect(priya.page.getByText('You and 1 more')).toBeVisible() // everyone is ticked by default

    await openActivities(jonas, trip.path)
    await expect(titled(jonas.page, 'Lunch at the bakery')).toBeVisible()
    await expect(jonas.page.getByText('Added by Priya Nair')).toBeVisible()
    await jonas.page.getByRole('button', { name: "I'm out" }).click()
    await expect(jonas.page.getByRole('button', { name: "I'm in" })).toBeVisible()
    await expect(jonas.page.getByText('1 going')).toBeVisible()

    await expect(priya.page.getByText('Just you so far')).toBeVisible(POLL)

    // It is the server's record, not the screen's: a reload keeps it.
    await jonas.page.reload()
    await expect(jonas.page.getByRole('button', { name: "I'm in" })).toBeVisible()
    await jonas.page.getByRole('button', { name: "I'm in" }).click()
    await expect(priya.page.getByText('You and 1 more')).toBeVisible(POLL)

    await closeAll(priya, jonas)
  })

  test('adding straight to the plan asks for a time, and the title stops at the limit', async ({ browser }) => {
    const priya = await newPerson(browser, 'Priya Nair')
    const trip = await createTrip(priya, 'Great Ocean Road')
    await openActivities(priya, trip.path)

    await priya.page.getByRole('button', { name: 'Add activity' }).click()
    await priya.page.getByLabel('What is it').pressSequentially('x'.repeat(130))
    expect((await priya.page.getByLabel('What is it').inputValue()).length).toBe(100)
    // Too long to type out here; the box carries the same limit the server enforces.
    await expect(priya.page.getByLabel('Anything the group should know')).toHaveAttribute('maxlength', '2000')

    await priya.page.getByRole('button', { name: 'Add to the plan' }).click()
    await expect(priya.page.getByText('Pick a date and time.')).toBeVisible()
    await expect(priya.page.getByText('Added to the plan.')).toHaveCount(0)

    await closeAll(priya)
  })

  test('the owner can delete anyone’s activity, a member only their own', async ({ browser }) => {
    const priya = await newPerson(browser, 'Priya Nair')
    const jonas = await newPerson(browser, 'Jonas Weber')
    const trip = await createTrip(priya, 'Great Ocean Road')
    await joinByLink(jonas, trip.code)

    await openActivities(jonas, trip.path)
    await addActivity(jonas, 'Jonas’s walk', { vote: true })
    await openActivities(priya, trip.path)
    await addActivity(priya, 'Priya’s drive', { vote: true })

    await tab(jonas.page, 'Voting').click()
    await expect(titled(jonas.page, 'Priya’s drive')).toBeVisible(POLL)
    await expect(jonas.page.getByRole('button', { name: 'Delete Jonas’s walk' })).toBeVisible()
    await expect(jonas.page.getByRole('button', { name: 'Delete Priya’s drive' })).toHaveCount(0)

    await tab(priya.page, 'Voting').click()
    await expect(titled(priya.page, 'Jonas’s walk')).toBeVisible()
    await expect(priya.page.getByRole('button', { name: 'Delete Priya’s drive' })).toBeVisible()
    await priya.page.getByRole('button', { name: 'Delete Jonas’s walk' }).click()
    await expect(priya.page.getByText('Activity deleted')).toBeVisible()
    await expect(titled(priya.page, 'Jonas’s walk')).toHaveCount(0)

    await expect(titled(jonas.page, 'Jonas’s walk')).toHaveCount(0, POLL)
    await expect(titled(jonas.page, 'Priya’s drive')).toBeVisible()

    await closeAll(priya, jonas)
  })

  test('someone leaving the trip lowers the bar, and an open vote can carry on the spot', async ({ browser }) => {
    const priya = await newPerson(browser, 'Priya Nair')
    const jonas = await newPerson(browser, 'Jonas Weber')
    const mia = await newPerson(browser, 'Mia Costa')
    const ethan = await newPerson(browser, 'Ethan Park')
    const trip = await createTrip(priya, 'Great Ocean Road')
    await joinByLink(jonas, trip.code)
    await joinByLink(mia, trip.code)
    await joinByLink(ethan, trip.code)

    // Four people: three votes carry it. Priya and Jonas make two.
    await openActivities(priya, trip.path)
    await addActivity(priya, 'Kayak to the seal colony', { vote: true })
    await tab(priya.page, 'Voting').click()
    await expect(priya.page.getByText('1 of 3 needed')).toBeVisible()

    await openActivities(jonas, trip.path)
    await tab(jonas.page, 'Voting').click()
    await jonas.page.getByRole('button', { name: /for$/ }).click()
    await expect(jonas.page.getByText('2 of 3 needed')).toBeVisible()
    await expect(priya.page.getByText('2 of 3 needed')).toBeVisible(POLL)

    // Ethan leaves. Three people need two, and two have voted for it.
    await ethan.page.goto(`${trip.path}/members`)
    await ethan.page.getByRole('button', { name: 'Leave this trip' }).click()
    await ethan.page.getByRole('button', { name: 'Leave trip' }).click()
    await expect(ethan.page).toHaveURL(/\/trips$/)

    await expect(priya.page.getByText('Nothing waiting on a vote.')).toBeVisible(POLL)
    await tab(priya.page, 'Plan').click()
    await expect(titled(priya.page, 'Kayak to the seal colony')).toBeVisible()
    await expect(priya.page.getByText('Voted in by you')).toBeVisible()
    await expect(priya.page.getByText('You and 1 more')).toBeVisible()

    await closeAll(priya, jonas, mia, ethan)
  })

  test('voting against: it is kept on the server, tapping it again takes it back, and turning it round carries the activity', async ({ browser }) => {
    const priya = await newPerson(browser, 'Priya Nair')
    const jonas = await newPerson(browser, 'Jonas Weber')
    const mia = await newPerson(browser, 'Mia Costa')
    const trip = await createTrip(priya, 'Great Ocean Road')
    await joinByLink(jonas, trip.code)
    await joinByLink(mia, trip.code)

    // Three people: two votes carry it. Priya's own vote is the first.
    await openActivities(priya, trip.path)
    await addActivity(priya, 'Kayak to the seal colony', { vote: true })
    await tab(priya.page, 'Voting').click()

    await openActivities(jonas, trip.path)
    await tab(jonas.page, 'Voting').click()
    const against = jonas.page.getByRole('button', { name: /against$/ })
    const forIt = jonas.page.getByRole('button', { name: /for$/ })

    await against.click()
    await expect(against).toHaveAttribute('aria-pressed', 'true')
    await expect(against).toContainText('1')
    await expect(jonas.page.getByText('1 of 2 needed')).toBeVisible()

    // Priya sees the vote against without reloading.
    await expect(priya.page.getByRole('button', { name: /against$/ })).toContainText('1', POLL)
    await expect(priya.page.getByRole('button', { name: /against$/ })).toHaveAttribute('aria-pressed', 'false')

    // Tapping it again takes it back, and a reload shows that is what the server holds.
    await against.click()
    await expect(against).toHaveAttribute('aria-pressed', 'false')
    await jonas.page.reload()
    await tab(jonas.page, 'Voting').click()
    await expect(against).toHaveAttribute('aria-pressed', 'false')
    await expect(against).toContainText('0')

    // Against again, kept over a reload, then turned round: that is two of three, so it is carried.
    await against.click()
    await expect(against).toHaveAttribute('aria-pressed', 'true')
    await jonas.page.reload()
    await tab(jonas.page, 'Voting').click()
    await expect(against).toHaveAttribute('aria-pressed', 'true')
    await forIt.click()
    await expect(jonas.page.getByText('Nothing waiting on a vote.')).toBeVisible()
    await tab(jonas.page, 'Plan').click()
    await expect(titled(jonas.page, 'Kayak to the seal colony')).toBeVisible()
    await expect(jonas.page.getByText('You and 1 more')).toBeVisible()

    await closeAll(priya, jonas, mia)
  })
})
