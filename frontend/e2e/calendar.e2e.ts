import { expect, test } from '@playwright/test'
import {
  activityTab,
  addActivity,
  closeAll,
  createTrip,
  joinByLink,
  newPerson,
  openActivities,
} from './helpers.ts'

/*
 * What activities do to the other screens that read them: the calendar, and the overview's "next
 * up" sign and Vote lamp. The dates are far enough ahead to always be "upcoming". The browser
 * shows a time back in the zone it was typed in, so the day and time read the same wherever this runs.
 * 15 June 2030 is a Saturday.
 */

const WHEN = '2030-06-15T12:30'
const DAY = 'Sat 15 Jun'

test.describe('calendar and overview', () => {
  test('an activity added to the plan is on the calendar and is what is next, for everyone', async ({ browser }) => {
    const priya = await newPerson(browser, 'Priya Nair')
    const jonas = await newPerson(browser, 'Jonas Weber')
    const trip = await createTrip(priya, 'Great Ocean Road')
    await joinByLink(jonas, trip.code)

    // Before anything is planned, both say so.
    await jonas.page.goto(`${trip.path}/calendar`)
    await expect(jonas.page.getByText('Nothing planned yet.')).toBeVisible()
    await jonas.page.goto(trip.path)
    await expect(jonas.page.getByText('Nothing planned yet')).toBeVisible()

    await openActivities(priya, trip.path)
    await addActivity(priya, 'Sunrise swim', { when: WHEN })

    // The agenda groups by day and opens a sheet for each item.
    await jonas.page.goto(`${trip.path}/calendar`)
    await expect(jonas.page.getByRole('heading', { name: DAY })).toBeVisible()
    await jonas.page.getByRole('button', { name: /Sunrise swim/ }).click()
    await expect(jonas.page.getByRole('dialog')).toContainText('Sunrise swim')
    await expect(jonas.page.getByRole('dialog')).toContainText(`${DAY}, 12:30`)
    await expect(jonas.page.getByRole('dialog')).toContainText('Activity')
    await jonas.page.getByRole('link', { name: 'Open in activities' }).click()
    await expect(jonas.page).toHaveURL(`${trip.path}/activities`)

    // The month view opens on the month of the first item and marks the day.
    await jonas.page.goto(`${trip.path}/calendar`)
    await jonas.page.getByRole('tab', { name: 'Month' }).click()
    await expect(jonas.page.getByRole('heading', { name: 'June 2030' })).toBeVisible()
    await jonas.page.getByRole('button', { name: '15 June, 1 items' }).click()
    await expect(jonas.page.getByRole('heading', { name: 'Saturday 15 June' })).toBeVisible()
    await jonas.page.getByRole('button', { name: /Sunrise swim/ }).click()
    await expect(jonas.page.getByRole('dialog')).toContainText('Sunrise swim')

    // And the overview's road sign says it is next, linking to the calendar.
    await jonas.page.goto(trip.path)
    const sign = jonas.page.getByRole('link', { name: /Next: Sunrise swim/ })
    await expect(sign).toBeVisible()
    await expect(sign).toContainText('12:30')
    await sign.click()
    await expect(jonas.page).toHaveURL(`${trip.path}/calendar`)

    await closeAll(priya, jonas)
  })

  test('something still being voted on is not on the calendar until it is carried, and the Vote lamp counts it', async ({ browser }) => {
    const priya = await newPerson(browser, 'Priya Nair')
    const jonas = await newPerson(browser, 'Jonas Weber')
    const trip = await createTrip(priya, 'Great Ocean Road')
    await joinByLink(jonas, trip.code)

    await openActivities(priya, trip.path)
    await addActivity(priya, 'Kayak to the seal colony', { vote: true, when: WHEN })

    // Priya proposed it, so it is not waiting on her; it is waiting on Jonas.
    await priya.page.goto(trip.path)
    await expect(priya.page.getByRole('link', { name: 'No ideas waiting on your vote. Open activities.' })).toBeVisible()
    await jonas.page.goto(trip.path)
    const lamp = jonas.page.getByRole('link', { name: '1 idea is waiting on your vote. Open activities.' })
    await expect(lamp).toBeVisible()
    await jonas.page.goto(`${trip.path}/calendar`)
    await expect(jonas.page.getByText('Nothing planned yet.')).toBeVisible()

    // The lamp goes straight to the Voting tab.
    await jonas.page.goto(trip.path)
    await lamp.click()
    await expect(jonas.page).toHaveURL(/\/activities\?tab=voting$/)
    await expect(activityTab(jonas.page, 'Voting')).toHaveAttribute('aria-selected', 'true')
    await jonas.page.getByRole('button', { name: /for$/ }).click()
    await expect(jonas.page.getByText('Nothing waiting on a vote.')).toBeVisible()

    // Two of two carries it: it is on the calendar, it is next, and the lamp goes out.
    await jonas.page.goto(`${trip.path}/calendar`)
    await expect(jonas.page.getByRole('heading', { name: DAY })).toBeVisible()
    await expect(jonas.page.getByRole('button', { name: /Kayak to the seal colony/ })).toBeVisible()
    await jonas.page.goto(trip.path)
    await expect(jonas.page.getByRole('link', { name: /Next: Kayak to the seal colony/ })).toBeVisible()
    await expect(jonas.page.getByRole('link', { name: 'No ideas waiting on your vote. Open activities.' })).toBeVisible()

    await closeAll(priya, jonas)
  })

  test('something voted in with no date waits on the Plan tab for one and stays off the calendar', async ({ browser }) => {
    const priya = await newPerson(browser, 'Priya Nair')
    const jonas = await newPerson(browser, 'Jonas Weber')
    const trip = await createTrip(priya, 'Great Ocean Road')
    await joinByLink(jonas, trip.code)

    await openActivities(priya, trip.path)
    await addActivity(priya, 'Winery visit', { vote: true })
    await openActivities(jonas, trip.path)
    await activityTab(jonas.page, 'Voting').click()
    await jonas.page.getByRole('button', { name: /for$/ }).click()

    await activityTab(jonas.page, 'Plan').click()
    await expect(jonas.page.getByText('Needs a date')).toBeVisible()
    await expect(jonas.page.getByText('No date yet')).toBeVisible()

    await jonas.page.goto(`${trip.path}/calendar`)
    await expect(jonas.page.getByText('Nothing planned yet.')).toBeVisible()
    await jonas.page.goto(trip.path)
    await expect(jonas.page.getByText('Nothing planned yet')).toBeVisible()

    await closeAll(priya, jonas)
  })
})
