import { expect, test } from '@playwright/test'
import {
  addLeg,
  closeAll,
  createTrip,
  expenseRow,
  joinByLink,
  legCard,
  newPerson,
  openExpenses,
  openFuel,
} from './helpers.ts'

/*
 * Fuel legs across several people's screens. The detailed rules (who may change or delete one, what
 * a leg has to satisfy, that its expense is written, kept in step and removed with it) are in the
 * backend's FuelService checks and FuelFlowTests; these check what each person sees and is offered,
 * that a leg and its expense reach the other screens, and that the balances come out right.
 * Like the other shared checks they wait up to 12 seconds, because they rely on the 5 second polling.
 *
 * The leg used throughout is 100 km at 8 L/100km and 200 c/L: 8 litres, $16.00. Shared between two
 * riders that is $8.00 each, so no test depends on which of them gets a spare cent.
 */

test.describe.configure({ timeout: 60_000 })

const POLL = { timeout: 12_000 }
const LEG = 'Lorne to Apollo Bay'
const FIGURES = { km: '100', efficiency: '8', cents: '200' }

test.describe('fuel', () => {
  test('a leg and its expense reach everyone, only the riders are charged, and only some are offered Delete', async ({ browser }) => {
    const priya = await newPerson(browser, 'Priya Nair')
    const jonas = await newPerson(browser, 'Jonas Weber')
    const mia = await newPerson(browser, 'Mia Costa')
    const trip = await createTrip(priya, 'Great Ocean Road')
    await joinByLink(jonas, trip.code)
    await joinByLink(mia, trip.code)

    await openFuel(priya, trip.path)
    await expect(priya.page.getByText('No legs yet.')).toBeVisible()
    await openFuel(jonas, trip.path)
    await openExpenses(mia, trip.path)

    // Priya drives, and Jonas chips in. Mia is left out. It arrives on Jonas's open screen by itself.
    await addLeg(priya, LEG, FIGURES, { leaveOut: ['Mia Costa'] })
    await expect(priya.page.getByText('Leg added, and charged to the riders as an expense.')).toBeVisible()
    const mine = legCard(priya.page, LEG)
    await expect(mine).toContainText('Priya Nair paid · 2 chipping in')
    await expect(mine).toContainText('$16.00')
    await expect(mine).toContainText('$8.00')
    await expect(legCard(jonas.page, LEG)).toContainText('Priya Nair paid · 2 chipping in', POLL)
    await expect(jonas.page.getByText('$16.00 total · your share $8.00')).toBeVisible()

    // Its expense is on the money screens: Jonas owes $8.00 of it, Priya is owed $8.00, and Mia, who
    // did not ride, is not in the split at all.
    await expect(expenseRow(mia.page, `Fuel: ${LEG}`)).toContainText('not your split', POLL)
    await expect(expenseRow(mia.page, `Fuel: ${LEG}`)).toContainText('$16.00')
    await openExpenses(jonas, trip.path)
    await expect(expenseRow(jonas.page, `Fuel: ${LEG}`)).toContainText('your share $8.00')
    await expect(jonas.page.getByText('You owe $8.00')).toBeVisible()
    await openExpenses(priya, trip.path)
    await expect(priya.page.getByText('You are owed $8.00')).toBeVisible()
    // It is read only there, and points back to the leg.
    await expect(expenseRow(priya.page, `Fuel: ${LEG}`).getByRole('link', { name: 'Edit the fuel leg' })).toBeVisible()
    await expect(priya.page.getByRole('button', { name: new RegExp(`^Delete Fuel: ${LEG}`) })).toHaveCount(0)

    // Who is offered Delete on the leg: the owner, who also drove, and nobody else.
    await openFuel(priya, trip.path)
    await openFuel(jonas, trip.path)
    await openFuel(mia, trip.path)
    await expect(priya.page.getByRole('button', { name: `Delete ${LEG}` })).toBeVisible()
    await expect(jonas.page.getByRole('button', { name: `Delete ${LEG}` })).toHaveCount(0)
    await expect(mia.page.getByRole('button', { name: `Delete ${LEG}` })).toHaveCount(0)

    // Deleting the leg takes its expense with it, and Jonas's position follows.
    await openExpenses(jonas, trip.path)
    await expect(expenseRow(jonas.page, `Fuel: ${LEG}`)).toBeVisible()
    await priya.page.getByRole('button', { name: `Delete ${LEG}` }).click()
    await priya.page.getByRole('button', { name: 'Delete leg' }).click()
    await expect(priya.page.getByText('Leg deleted, along with its expense.')).toBeVisible()
    await expect(legCard(priya.page, LEG)).toHaveCount(0)
    await expect(expenseRow(jonas.page, `Fuel: ${LEG}`)).toHaveCount(0, POLL)
    await expect(jonas.page.getByText('You owe $8.00')).toHaveCount(0, POLL)

    await closeAll(priya, jonas, mia)
  })

  test('the driver is paid at the pump, can delete a leg someone else added, and the form says what is wrong', async ({ browser }) => {
    const priya = await newPerson(browser, 'Priya Nair')
    const jonas = await newPerson(browser, 'Jonas Weber')
    const trip = await createTrip(priya, 'Great Ocean Road')
    await joinByLink(jonas, trip.code)
    await openFuel(priya, trip.path)
    await openFuel(jonas, trip.path)

    // What the form catches itself leaves the drawer open and adds nothing.
    await addLeg(priya, LEG, { km: '100', efficiency: '8', cents: '195.5' })
    await expect(priya.page.getByText('Enter whole cents per litre.')).toBeVisible()
    await priya.page.getByRole('dialog').getByLabel('Cents/L').fill('200')
    await priya.page.getByRole('dialog').getByRole('checkbox', { name: /Priya Nair/ }).click()
    await priya.page.getByRole('dialog').getByRole('checkbox', { name: /Jonas Weber/ }).click()
    await priya.page.getByRole('dialog').getByRole('button', { name: 'Add leg and charge riders' }).click()
    await expect(priya.page.getByText('Pick at least one person to chip in.')).toBeVisible()
    // What only the server can tell is shown as it words it: a leg of next to nothing costs nothing.
    await priya.page.getByRole('dialog').getByRole('checkbox', { name: /Priya Nair/ }).click()
    await priya.page.getByRole('dialog').getByLabel('Distance km').fill('0.01')
    await priya.page.getByRole('dialog').getByLabel('L/100km').fill('0.5')
    await priya.page.getByRole('dialog').getByLabel('Cents/L').fill('5')
    await priya.page.getByRole('dialog').getByRole('button', { name: 'Add leg and charge riders' }).click()
    await expect(priya.page.getByText('That leg costs nothing. Check the distance, litres and price.')).toBeVisible()
    await expect(legCard(priya.page, LEG)).toHaveCount(0)

    // Priya adds a real one, but Jonas is the one who pays at the pump, and both ride.
    await priya.page.getByRole('dialog').getByLabel('Distance km').fill('100')
    await priya.page.getByRole('dialog').getByLabel('L/100km').fill('8')
    await priya.page.getByRole('dialog').getByLabel('Cents/L').fill('200')
    await priya.page.getByRole('dialog').getByRole('checkbox', { name: /Jonas Weber/ }).click()
    await priya.page.getByRole('dialog').getByRole('combobox', { name: 'Driver' }).click()
    await priya.page.getByRole('option', { name: 'Jonas Weber' }).click()
    await priya.page.getByRole('dialog').getByRole('button', { name: 'Add leg and charge riders' }).click()
    await expect(priya.page.getByText('Leg added, and charged to the riders as an expense.')).toBeVisible()
    await expect(legCard(priya.page, LEG)).toContainText('Jonas Weber paid · 2 chipping in')

    // He is paid back $8.00, and can delete it though he did not add it. So can the owner who did.
    await expect(legCard(jonas.page, LEG)).toBeVisible(POLL)
    await expect(jonas.page.getByRole('button', { name: `Delete ${LEG}` })).toBeVisible()
    await expect(priya.page.getByRole('button', { name: `Delete ${LEG}` })).toBeVisible()
    await openExpenses(jonas, trip.path)
    await expect(jonas.page.getByText('You are owed $8.00')).toBeVisible()
    await openExpenses(priya, trip.path)
    await expect(priya.page.getByText('You owe $8.00')).toBeVisible()
    await openFuel(jonas, trip.path)
    await jonas.page.getByRole('button', { name: `Delete ${LEG}` }).click()
    await jonas.page.getByRole('button', { name: 'Delete leg' }).click()
    await expect(jonas.page.getByText('Leg deleted, along with its expense.')).toBeVisible()
    await openFuel(priya, trip.path)
    await expect(legCard(priya.page, LEG)).toHaveCount(0)

    await closeAll(priya, jonas)
  })
})
