import { expect, test } from '@playwright/test'
import { closeAll, createTrip, joinByLink, newPerson } from './helpers.ts'

/*
 * The trip settings screen across two people. Which fields are the owner's and what each is checked
 * against is in the backend's TripFlowTests; these check what each person is offered and that a
 * change reaches the other screen. The screen is read when it is opened, so the second person reloads it.
 */

test.describe.configure({ timeout: 60_000 })

test.describe('trip settings', () => {
  test('the owner changes the details and everyone sees them, a member can change only the shared settings', async ({ browser }) => {
    const priya = await newPerson(browser, 'Priya Nair')
    const jonas = await newPerson(browser, 'Jonas Weber')
    const trip = await createTrip(priya, 'Great Ocean Road')
    await joinByLink(jonas, trip.code)

    await priya.page.goto(`${trip.path}/settings`)
    await jonas.page.goto(`${trip.path}/settings`)
    await expect(priya.page.getByRole('heading', { name: 'Trip settings' })).toBeVisible()

    // A member sees the details but cannot change them, and has no button to save them.
    await expect(jonas.page.getByText('Only the trip owner can change these.')).toBeVisible()
    await expect(jonas.page.getByLabel('Trip name')).toBeDisabled()
    await expect(jonas.page.getByRole('button', { name: 'Save trip details' })).toHaveCount(0)

    // The owner renames the trip, and sets a cap.
    await priya.page.getByLabel('Trip name').fill('Great Ocean Road, again')
    await priya.page.getByLabel('Budget cap').fill('1500')
    await priya.page.getByRole('button', { name: 'Save trip details' }).click()
    await expect(priya.page.getByText('Trip details saved.')).toBeVisible()
    // The settings screen is read when it is opened, so Jonas opens it again.
    await jonas.page.reload()
    await expect(jonas.page.getByLabel('Trip name')).toHaveValue('Great Ocean Road, again')
    await expect(jonas.page.getByLabel('Budget cap')).toHaveValue('1500.00')

    // The cap is what the money screen measures against.
    await jonas.page.goto(`${trip.path}/expenses`)
    await expect(jonas.page.getByText('Spend against budget cap')).toBeVisible()
    await expect(jonas.page.getByText('$0.00 of $1,500.00')).toBeVisible()

    // Saving with nothing changed says so instead of asking the server.
    await priya.page.getByRole('button', { name: 'Save trip details' }).click()
    await expect(priya.page.getByText('Nothing to save. Nothing has changed.')).toBeVisible()

    // What the form catches itself.
    await priya.page.getByLabel('Trip name').fill('   ')
    await priya.page.getByRole('button', { name: 'Save trip details' }).click()
    await expect(priya.page.getByText('Give the trip a name.')).toBeVisible()
    await priya.page.getByLabel('Trip name').fill('Great Ocean Road, again')

    // Any member can change the shared money and fuel settings, and the owner sees it.
    await jonas.page.goto(`${trip.path}/settings`)
    await jonas.page.getByLabel('Allowance each').fill('40')
    await jonas.page.getByRole('button', { name: 'Save money and fuel' }).click()
    await expect(jonas.page.getByText('Money and fuel settings saved.')).toBeVisible()
    await priya.page.reload()
    await expect(priya.page.getByLabel('Allowance each')).toHaveValue('40.00')

    await closeAll(priya, jonas)
  })
})
