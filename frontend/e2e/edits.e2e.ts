import { expect, test } from '@playwright/test'
import {
  addBooking,
  addExpense,
  addLeg,
  bookingCard,
  closeAll,
  createTrip,
  expenseRow,
  joinByLink,
  legCard,
  newPerson,
  openBookings,
  openExpenses,
  openFuel,
} from './helpers.ts'

/*
 * Changing what was already added: a booking, an expense and a fuel leg. Who may change each, and
 * what a change has to satisfy, is in the backend's flow tests (including that only what is sent is
 * changed, and what happens to people who have left); these check what each person is offered, that
 * the edit form starts from what is saved, and that a change reaches the other screens and the
 * balances. Like the other shared checks they wait up to 12 seconds.
 */

test.describe.configure({ timeout: 60_000 })

const POLL = { timeout: 12_000 }

test.describe('editing', () => {
  test('a booking can be changed by the people who may delete it, and the change reaches everyone', async ({ browser }) => {
    const priya = await newPerson(browser, 'Priya Nair')
    const jonas = await newPerson(browser, 'Jonas Weber')
    const mia = await newPerson(browser, 'Mia Costa')
    const trip = await createTrip(priya, 'Great Ocean Road')
    await joinByLink(jonas, trip.code)
    await joinByLink(mia, trip.code)

    await openBookings(jonas, trip.path)
    await addBooking(jonas, 'JQ 610 BNE to MEL', { departs: '2030-06-15T12:30', arrives: '2030-06-15T15:00' })
    await expect(jonas.page.getByText('Booking saved.')).toBeVisible()
    await openBookings(priya, trip.path)
    await expect(bookingCard(priya.page, 'JQ 610 BNE to MEL')).toBeVisible()

    // The form starts from what is saved.
    await jonas.page.getByRole('button', { name: 'Edit JQ 610 BNE to MEL' }).click()
    await expect(jonas.page.getByLabel('Flight number')).toHaveValue('JQ 610 BNE to MEL')
    await jonas.page.getByLabel('Flight number').fill('JQ 612 BNE to MEL')
    await jonas.page.getByRole('button', { name: 'Save changes' }).click()
    await expect(jonas.page.getByText('Booking changed.')).toBeVisible()
    await expect(bookingCard(priya.page, 'JQ 612 BNE to MEL')).toBeVisible(POLL)
    await expect(bookingCard(priya.page, 'JQ 610 BNE to MEL')).toHaveCount(0)

    // The owner may change it too. Mia, who did not add it and whose it is not, is not offered the edit.
    await expect(priya.page.getByRole('button', { name: 'Edit JQ 612 BNE to MEL' })).toBeVisible()
    await openBookings(mia, trip.path)
    await expect(bookingCard(mia.page, 'JQ 612 BNE to MEL')).toBeVisible()
    await expect(mia.page.getByRole('button', { name: /^Edit / })).toHaveCount(0)

    await closeAll(priya, jonas, mia)
  })

  test('an expense can be changed by the people who may delete it, and everyone’s balance follows', async ({ browser }) => {
    const priya = await newPerson(browser, 'Priya Nair')
    const jonas = await newPerson(browser, 'Jonas Weber')
    const mia = await newPerson(browser, 'Mia Costa')
    const trip = await createTrip(priya, 'Great Ocean Road')
    await joinByLink(jonas, trip.code)
    await joinByLink(mia, trip.code)

    await openExpenses(priya, trip.path)
    await openExpenses(mia, trip.path)
    await addExpense(priya, 'Groceries', '90')
    await expect(priya.page.getByText('Expense added. Balances updated.')).toBeVisible()
    await expect(mia.page.getByText('You owe $30.00')).toBeVisible(POLL)

    // Mia did not add it or pay for it, so she is not offered the edit. Priya is.
    await expect(mia.page.getByRole('button', { name: 'Edit Groceries' })).toHaveCount(0)
    await priya.page.getByRole('button', { name: 'Edit Groceries' }).click()
    const drawer = priya.page.getByRole('dialog')
    await expect(drawer.getByLabel('What was it')).toHaveValue('Groceries')
    await expect(drawer.getByLabel('Amount')).toHaveValue('90.00')

    // The amount goes up, and it is still shared three ways: $40.00 each.
    await drawer.getByLabel('Amount').fill('120')
    await drawer.getByRole('button', { name: 'Save changes' }).click()
    await expect(priya.page.getByText('Expense changed. Balances updated.')).toBeVisible()
    await expect(priya.page.getByRole('dialog')).toBeHidden()
    await expect(priya.page.getByText('You are owed $80.00')).toBeVisible()
    await expect(mia.page.getByText('You owe $40.00')).toBeVisible(POLL)

    // Leave Mia out of it: it is Priya and Jonas now, $60.00 each.
    await priya.page.getByRole('button', { name: 'Edit Groceries' }).click()
    await priya.page.getByRole('dialog').getByRole('checkbox', { name: /Mia Costa/ }).click()
    await priya.page.getByRole('dialog').getByRole('button', { name: 'Save changes' }).click()
    await expect(priya.page.getByRole('dialog')).toBeHidden()
    await expect(priya.page.getByText('You are owed $60.00')).toBeVisible()
    await expect(mia.page.getByText('You are square with everyone.')).toBeVisible(POLL)
    await expect(expenseRow(mia.page, 'Groceries')).toContainText('not your split')

    // The form stops what the server would refuse, and keeps the drawer open.
    await priya.page.getByRole('button', { name: 'Edit Groceries' }).click()
    await priya.page.getByRole('dialog').getByLabel('What was it').fill('')
    await priya.page.getByRole('dialog').getByRole('button', { name: 'Save changes' }).click()
    await expect(priya.page.getByText('Say what the money went on.')).toBeVisible()

    await closeAll(priya, jonas, mia)
  })

  test('a fuel leg can be changed by the people who may delete it, and its expense follows', async ({ browser }) => {
    const priya = await newPerson(browser, 'Priya Nair')
    const jonas = await newPerson(browser, 'Jonas Weber')
    const mia = await newPerson(browser, 'Mia Costa')
    const trip = await createTrip(priya, 'Great Ocean Road')
    await joinByLink(jonas, trip.code)
    await joinByLink(mia, trip.code)

    // 100 km at 8 L/100km and 200 c/L is $16.00, $8.00 each between Priya and Jonas.
    await openFuel(priya, trip.path)
    await addLeg(priya, 'Lorne to Apollo Bay', { km: '100', efficiency: '8', cents: '200' }, { leaveOut: ['Mia Costa'] })
    await expect(priya.page.getByText('Leg added, and charged to the riders as an expense.')).toBeVisible()
    await openFuel(mia, trip.path)
    await expect(legCard(mia.page, 'Lorne to Apollo Bay')).toBeVisible()
    await expect(mia.page.getByRole('button', { name: 'Edit Lorne to Apollo Bay' })).toHaveCount(0)

    // The form starts from the leg. Make it 150 km, $24.00, and put Mia in: $8.00 each between three.
    await priya.page.getByRole('button', { name: 'Edit Lorne to Apollo Bay' }).click()
    const drawer = priya.page.getByRole('dialog')
    await expect(drawer.getByLabel('Distance km')).toHaveValue('100')
    await expect(drawer.getByRole('checkbox', { name: /Mia Costa/ })).not.toBeChecked()
    await drawer.getByLabel('Distance km').fill('150')
    await drawer.getByRole('checkbox', { name: /Mia Costa/ }).click()
    await drawer.getByRole('button', { name: 'Save changes' }).click()
    await expect(priya.page.getByText('Leg changed.')).toBeVisible()
    const mine = legCard(priya.page, 'Lorne to Apollo Bay')
    await expect(mine).toContainText('3 chipping in')
    await expect(mine).toContainText('$24.00')

    await expect(legCard(mia.page, 'Lorne to Apollo Bay')).toContainText('3 chipping in', POLL)
    await openExpenses(mia, trip.path)
    await expect(mia.page.getByText('You owe $8.00')).toBeVisible()
    await expect(expenseRow(mia.page, 'Fuel: Lorne to Apollo Bay')).toContainText('$24.00')

    await closeAll(priya, jonas, mia)
  })
})
