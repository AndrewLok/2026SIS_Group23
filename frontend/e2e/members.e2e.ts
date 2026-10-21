import { expect, test } from '@playwright/test'
import { closeAll, createTrip, joinByLink, memberRow, newPerson } from './helpers.ts'

/*
 * The members screen from the owner's side and the member's side. The rules themselves (only an
 * owner removes people, a trip always keeps an owner) are checked in the backend's TripFlowTests;
 * these check what each person is offered and that it reaches the person removed.
 */

test.describe('members', () => {
  test('only the owner is offered a way to remove people, and nobody is offered a way to remove the owner', async ({ browser }) => {
    const priya = await newPerson(browser, 'Priya Nair')
    const jonas = await newPerson(browser, 'Jonas Weber')
    const trip = await createTrip(priya, 'Great Ocean Road')
    await joinByLink(jonas, trip.code)

    // The owner can remove Jonas, but has no button for herself: she cannot leave, or be removed.
    await priya.page.goto(`${trip.path}/members`)
    await expect(memberRow(priya.page, 'Jonas Weber')).toBeVisible()
    await expect(priya.page.getByRole('button', { name: 'Remove Jonas Weber' })).toBeVisible()
    await expect(priya.page.getByRole('button', { name: 'Remove Priya Nair' })).toHaveCount(0)
    await expect(priya.page.getByRole('button', { name: 'Leave this trip' })).toHaveCount(0)

    // Jonas can leave, and has no way to remove anyone.
    await jonas.page.goto(`${trip.path}/members`)
    await expect(memberRow(jonas.page, 'Priya Nair')).toBeVisible()
    await expect(jonas.page.getByRole('button', { name: /^Remove/ })).toHaveCount(0)
    await expect(jonas.page.getByRole('button', { name: 'Leave this trip' })).toBeVisible()

    await closeAll(priya, jonas)
  })

  test('removing someone asks first, takes them off the trip, and the invite link brings them back', async ({ browser }) => {
    const priya = await newPerson(browser, 'Priya Nair')
    const jonas = await newPerson(browser, 'Jonas Weber')
    const mia = await newPerson(browser, 'Mia Costa')
    const trip = await createTrip(priya, 'Great Ocean Road')
    await joinByLink(jonas, trip.code)
    await joinByLink(mia, trip.code)

    await priya.page.goto(`${trip.path}/members`)
    await expect(memberRow(priya.page, 'Mia Costa')).toBeVisible()

    // Changing her mind at the prompt removes nobody.
    await priya.page.getByRole('button', { name: 'Remove Jonas Weber' }).click()
    await expect(priya.page.getByRole('alertdialog')).toContainText('Remove Jonas Weber from this trip?')
    await priya.page.getByRole('button', { name: 'Keep them' }).click()
    await expect(memberRow(priya.page, 'Jonas Weber')).toBeVisible()

    await priya.page.getByRole('button', { name: 'Remove Jonas Weber' }).click()
    await priya.page.getByRole('alertdialog').getByRole('button', { name: 'Remove Jonas Weber' }).click()
    await expect(priya.page.getByText('Jonas Weber removed. Splits updated.')).toBeVisible()
    await expect(memberRow(priya.page, 'Jonas Weber')).toHaveCount(0)
    await expect(memberRow(priya.page, 'Mia Costa')).toBeVisible()

    // To Jonas the trip no longer exists, however he asks for it.
    await jonas.page.goto('/trips')
    await expect(jonas.page.getByText('Great Ocean Road')).toHaveCount(0)
    await jonas.page.goto(`${trip.path}/members`)
    await expect(jonas.page.getByText('Priya Nair')).toHaveCount(0)

    // Mia, who was not removed, is untouched.
    await mia.page.goto(`${trip.path}/members`)
    await expect(memberRow(mia.page, 'Priya Nair')).toBeVisible()
    await expect(memberRow(mia.page, 'Mia Costa')).toBeVisible()

    // Removing someone is not a ban: the same code lets them straight back in.
    await joinByLink(jonas, trip.code)
    await priya.page.reload()
    await expect(memberRow(priya.page, 'Jonas Weber')).toBeVisible()

    await closeAll(priya, jonas, mia)
  })
})
