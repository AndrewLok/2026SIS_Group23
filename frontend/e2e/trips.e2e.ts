import { expect, test } from '@playwright/test'
import { closeAll, CODE_PATTERN, createTrip, joinByLink, memberRow, newPerson, readInviteCode } from './helpers.ts'

/*
 * What only a real browser, the Vite proxy, the session cookie and the backend can prove together.
 * The detailed permission rules (who may rename, who may remove whom) are checked in the
 * backend's TripFlowTests; these cover the journeys across two people's screens.
 */

test.describe('trips', () => {
  test('creating a trip makes you its owner and shows it on the overview', async ({ browser }) => {
    const priya = await newPerson(browser, 'Priya Nair')

    const trip = await createTrip(priya, 'Great Ocean Road')
    await expect(priya.page.getByText('Great Ocean Road').first()).toBeVisible()

    await priya.page.goto(`${trip.path}/members`)
    await expect(memberRow(priya.page, 'Priya Nair')).toBeVisible()
    await expect(memberRow(priya.page, 'Priya Nair').getByText('owner', { exact: true })).toBeVisible()
    expect(trip.code).toMatch(CODE_PATTERN)

    // It is on the list, and survives a reload because it lives on the server.
    await priya.page.goto('/trips')
    await expect(priya.page.getByText('Great Ocean Road')).toBeVisible()

    await closeAll(priya)
  })

  test("somebody else's trip is not on your list and cannot be opened by its address", async ({ browser }) => {
    const priya = await newPerson(browser, 'Priya Nair')
    const jonas = await newPerson(browser, 'Jonas Weber')
    const trip = await createTrip(priya, 'Great Ocean Road')

    await jonas.page.goto('/trips')
    await expect(jonas.page.getByText('Great Ocean Road')).toHaveCount(0)

    await jonas.page.goto(trip.path)
    await expect(jonas.page.getByText('Great Ocean Road')).toHaveCount(0)

    await closeAll(priya, jonas)
  })

  test('an invite link shows a preview, joining puts both people on the same trip', async ({ browser }) => {
    const priya = await newPerson(browser, 'Priya Nair')
    const jonas = await newPerson(browser, 'Jonas Weber')
    const trip = await createTrip(priya, 'Great Ocean Road')

    // A lower-case code in the link still works.
    await jonas.page.goto(`/join/${trip.code.toLowerCase()}`)
    await expect(jonas.page.getByText('Great Ocean Road')).toBeVisible()
    await expect(jonas.page.getByText('Victoria')).toBeVisible()
    await expect(jonas.page.getByText('1 person is already on this trip')).toBeVisible()
    await jonas.page.getByRole('button', { name: 'Join this trip' }).click()
    await expect(jonas.page).toHaveURL(trip.path)

    await jonas.page.goto(`${trip.path}/members`)
    await expect(memberRow(jonas.page, 'Priya Nair')).toBeVisible()
    await expect(memberRow(jonas.page, 'Jonas Weber')).toBeVisible()
    // Making a new code is the owner's job.
    await expect(jonas.page.getByRole('button', { name: 'Regenerate' })).toHaveCount(0)

    // The owner sees the new member after a reload.
    await priya.page.goto(`${trip.path}/members`)
    await expect(memberRow(priya.page, 'Jonas Weber')).toBeVisible()

    await closeAll(priya, jonas)
  })

  test('a code that matches nothing says so instead of showing a trip', async ({ browser }) => {
    const jonas = await newPerson(browser, 'Jonas Weber')

    await jonas.page.goto('/join/ZZZZZZ')
    await expect(jonas.page.getByText('That code does not match a trip')).toBeVisible()
    await expect(jonas.page.getByRole('button', { name: 'Join this trip' })).toHaveCount(0)

    await closeAll(jonas)
  })

  test('a new code kills the old one, and the new one works', async ({ browser }) => {
    const priya = await newPerson(browser, 'Priya Nair')
    const mia = await newPerson(browser, 'Mia Chen')
    const trip = await createTrip(priya, 'Great Ocean Road')

    await priya.page.goto(`${trip.path}/members`)
    await priya.page.getByRole('button', { name: 'Regenerate' }).click()
    const code = priya.page.locator('p.select-all')
    await expect(code).not.toHaveText(trip.code)
    await expect(code).toHaveText(CODE_PATTERN)
    const newCode = (await code.innerText()).trim()

    await mia.page.goto(`/join/${trip.code}`)
    await expect(mia.page.getByText('That code does not match a trip')).toBeVisible()

    await mia.page.goto(`/join/${newCode}`)
    await expect(mia.page.getByText('Great Ocean Road')).toBeVisible()
    await expect(mia.page.getByRole('button', { name: 'Join this trip' })).toBeVisible()

    // Reloading shows the stored code, not just what was on screen.
    expect(await readInviteCode(priya, trip.path)).toBe(newCode)

    await closeAll(priya, mia)
  })

  test('a shared setting changed by one member is seen by the other', async ({ browser }) => {
    const priya = await newPerson(browser, 'Priya Nair')
    const jonas = await newPerson(browser, 'Jonas Weber')
    const trip = await createTrip(priya, 'Great Ocean Road')
    await joinByLink(jonas, trip.code)

    // "Private debts" is the switch on the expenses page.
    await jonas.page.goto(`${trip.path}/expenses`)
    const jonasSwitch = jonas.page.getByRole('switch').first()
    const before = await jonasSwitch.getAttribute('aria-checked')
    await jonasSwitch.click()
    await expect(jonasSwitch).not.toHaveAttribute('aria-checked', before ?? '')

    await priya.page.goto(`${trip.path}/expenses`)
    await expect(priya.page.getByRole('switch').first()).not.toHaveAttribute('aria-checked', before ?? '')

    await closeAll(priya, jonas)
  })

  test('a member who leaves loses the trip, and the owner no longer lists them', async ({ browser }) => {
    const priya = await newPerson(browser, 'Priya Nair')
    const jonas = await newPerson(browser, 'Jonas Weber')
    const trip = await createTrip(priya, 'Great Ocean Road')
    await joinByLink(jonas, trip.code)

    await jonas.page.goto(`${trip.path}/members`)
    await jonas.page.getByRole('button', { name: 'Leave this trip' }).click()
    await jonas.page.getByRole('button', { name: 'Leave trip' }).click()
    await expect(jonas.page).toHaveURL(/\/trips$/)
    await expect(jonas.page.getByText('Great Ocean Road')).toHaveCount(0)

    await jonas.page.goto(trip.path)
    await expect(jonas.page.getByText('Great Ocean Road')).toHaveCount(0)

    await priya.page.goto(`${trip.path}/members`)
    await expect(memberRow(priya.page, 'Priya Nair')).toBeVisible()
    await expect(memberRow(priya.page, 'Jonas Weber')).toHaveCount(0)

    await closeAll(priya, jonas)
  })
})
