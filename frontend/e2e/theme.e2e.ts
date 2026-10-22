import { expect, test } from '@playwright/test'
import { closeAll, createTrip, newPerson } from './helpers.ts'

/*
 * Night and daylight. Night is the default, the choice is kept in the browser rather than on the
 * account, and the overview's cluster stays a night scene whichever is chosen.
 */

const DARK = /\bdark\b/

test.describe('theme', () => {
  test('night is the default, the toggle switches to daylight and back, and the choice survives a reload', async ({ browser }) => {
    const priya = await newPerson(browser, 'Priya Nair')
    const { page } = priya
    await page.goto('/trips')
    await expect(page.locator('html')).toHaveClass(DARK)

    await page.getByRole('button', { name: 'Switch to light mode' }).click()
    await expect(page.locator('html')).not.toHaveClass(DARK)
    await page.reload()
    await expect(page.getByRole('button', { name: 'Switch to dark mode' })).toBeVisible()
    await expect(page.locator('html')).not.toHaveClass(DARK)

    await page.getByRole('button', { name: 'Switch to dark mode' }).click()
    await expect(page.locator('html')).toHaveClass(DARK)

    await closeAll(priya)
  })

  test('it is on the trip screens too, and the overview cluster stays night in daylight', async ({ browser }) => {
    const priya = await newPerson(browser, 'Priya Nair')
    const trip = await createTrip(priya, 'Great Ocean Road')
    const { page } = priya
    await page.goto(trip.path)
    await page.getByRole('button', { name: 'Switch to light mode' }).click()
    await expect(page.locator('html')).not.toHaveClass(DARK)
    await expect(page.getByRole('region', { name: 'Dashboard' })).toHaveClass(/\bnight\b/)

    // The other screens follow the theme: the page is not the night panel colour any more.
    await page.goto(`${trip.path}/expenses`)
    await expect(page.locator('body')).not.toHaveCSS('background-color', 'rgb(11, 13, 15)')

    await closeAll(priya)
  })
})
