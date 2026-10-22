import { expect, test } from '@playwright/test'
import { addExpense, closeAll, createTrip, expenseRow, joinByLink, newPerson, openExpenses } from './helpers.ts'

/*
 * Expenses across several people's screens. The detailed rules (who may change or delete one, what
 * a split has to satisfy) are in the backend's ExpenseFlowTests; these check what each person sees
 * and is offered, that a change reaches the other screens, and that the balances come out right.
 * Like the activity checks they wait up to 12 seconds, because they rely on the 5 second polling.
 *
 * Amounts are chosen to divide evenly between three people, so no test depends on which of them
 * gets a spare cent.
 */

test.describe.configure({ timeout: 60_000 })

const POLL = { timeout: 12_000 }

test.describe('expenses', () => {
  test('an expense reaches everyone, the balances add up, and only some people are offered Delete', async ({ browser }) => {
    const priya = await newPerson(browser, 'Priya Nair')
    const jonas = await newPerson(browser, 'Jonas Weber')
    const mia = await newPerson(browser, 'Mia Costa')
    const trip = await createTrip(priya, 'Great Ocean Road')
    await joinByLink(jonas, trip.code)
    await joinByLink(mia, trip.code)

    await openExpenses(priya, trip.path)
    await expect(priya.page.getByText('Nothing spent yet.')).toBeVisible()
    await openExpenses(jonas, trip.path)
    await openExpenses(mia, trip.path)

    // Priya pays $90 for all three. It arrives on the others' open screens by itself.
    await addExpense(priya, 'Groceries', '90')
    await expect(priya.page.getByText('Expense added. Balances updated.')).toBeVisible()
    await expect(expenseRow(jonas.page, 'Groceries')).toContainText('your share $30.00', POLL)
    await expect(jonas.page.getByText('You owe $30.00')).toBeVisible()
    await expect(mia.page.getByText('You owe $30.00')).toBeVisible(POLL)
    await expect(priya.page.getByText('You are owed $60.00')).toBeVisible()

    // Jonas pays $30 for all three. Everything is then worked out between the three of them.
    await addExpense(jonas, 'Taxi', '30')
    await expect(jonas.page.getByText('Expense added. Balances updated.')).toBeVisible()
    await expect(priya.page.getByText('You are owed $50.00')).toBeVisible(POLL)
    await expect(mia.page.getByText('You owe $40.00')).toBeVisible(POLL)
    await expect(jonas.page.getByText('You owe $10.00')).toBeVisible()
    // Settling up: Mia and Jonas each owe Priya, and Mia sees only what involves her.
    await expect(priya.page.getByText('Mia Costa owes you')).toBeVisible()
    await expect(priya.page.getByText('Jonas Weber owes you')).toBeVisible()
    await expect(mia.page.getByText('You owe Priya Nair')).toBeVisible()

    // Who is offered Delete: the owner on both, Jonas on the one he added, Mia on neither.
    await expect(priya.page.getByRole('button', { name: 'Delete Groceries' })).toBeVisible()
    await expect(priya.page.getByRole('button', { name: 'Delete Taxi' })).toBeVisible()
    await expect(jonas.page.getByRole('button', { name: 'Delete Taxi' })).toBeVisible()
    await expect(jonas.page.getByRole('button', { name: 'Delete Groceries' })).toHaveCount(0)
    await expect(mia.page.getByRole('button', { name: /^Delete / })).toHaveCount(0)

    // Priya deletes hers. It goes from Jonas's open screen and his position follows: only the taxi
    // is left, which he paid for all three, so he is owed $20.
    await priya.page.getByRole('button', { name: 'Delete Groceries' }).click()
    await priya.page.getByRole('button', { name: 'Delete expense' }).click()
    await expect(priya.page.getByText('Expense deleted. Balances updated.')).toBeVisible()
    await expect(expenseRow(jonas.page, 'Groceries')).toHaveCount(0, POLL)
    await expect(jonas.page.getByText('You are owed $20.00')).toBeVisible()
    await expect(expenseRow(jonas.page, 'Taxi')).toBeVisible()

    await closeAll(priya, jonas, mia)
  })

  test('exact amounts are shared as entered, and the form stops what the server would refuse', async ({ browser }) => {
    const priya = await newPerson(browser, 'Priya Nair')
    const jonas = await newPerson(browser, 'Jonas Weber')
    const trip = await createTrip(priya, 'Great Ocean Road')
    await joinByLink(jonas, trip.code)
    await openExpenses(priya, trip.path)
    await openExpenses(jonas, trip.path)

    // More than the total is caught on the form, and the drawer stays open.
    await addExpense(priya, 'Kayak', '100', { owed: { 'Jonas Weber': '150' } })
    await expect(priya.page.getByText('That is $50.00 more than the total.')).toBeVisible()
    await expect(priya.page.getByRole('dialog')).toBeVisible()

    // Put right, it saves. Priya keeps what is left, $70, and Jonas owes his $30.
    await priya.page.getByRole('dialog').getByLabel('Jonas Weber').fill('30')
    await priya.page.getByRole('dialog').getByRole('button', { name: 'Add expense' }).click()
    await expect(priya.page.getByText('Expense added. Balances updated.')).toBeVisible()
    const mine = expenseRow(priya.page, 'Kayak')
    await expect(mine).toContainText('exact amounts')
    await expect(mine).toContainText('your share $70.00')
    await expect(priya.page.getByText('You are owed $30.00')).toBeVisible()
    const theirs = expenseRow(jonas.page, 'Kayak')
    await expect(theirs).toContainText('your share $30.00', POLL)
    await expect(jonas.page.getByText('You owe $30.00')).toBeVisible()

    // What is typed in the description stops at the server's limit.
    await priya.page.getByRole('button', { name: 'Add expense' }).first().click()
    const description = priya.page.getByRole('dialog').getByLabel('What was it')
    await description.fill('x'.repeat(150))
    await expect(description).toHaveValue('x'.repeat(100))

    await closeAll(priya, jonas)
  })

  test('someone who leaves does not take the money with them', async ({ browser }) => {
    const priya = await newPerson(browser, 'Priya Nair')
    const jonas = await newPerson(browser, 'Jonas Weber')
    const mia = await newPerson(browser, 'Mia Costa')
    const trip = await createTrip(priya, 'Great Ocean Road')
    await joinByLink(jonas, trip.code)
    await joinByLink(mia, trip.code)

    // Jonas pays $60 for the three of them, so Priya owes $20.
    await openExpenses(jonas, trip.path)
    await addExpense(jonas, 'Hire car', '60')
    await expect(jonas.page.getByText('Expense added. Balances updated.')).toBeVisible()
    await openExpenses(priya, trip.path)
    await expect(priya.page.getByText('You owe $20.00')).toBeVisible()

    await jonas.page.goto(`${trip.path}/members`)
    await jonas.page.getByRole('button', { name: 'Leave this trip' }).click()
    await jonas.page.getByRole('button', { name: 'Leave trip' }).click()
    await expect(jonas.page).toHaveURL(/\/trips$/)

    // Priya's screen notices he has gone (the heading counts two members now). The form always names
    // who is sharing, so the expense is still split three ways as it was agreed: Jonas still owes
    // his part and Priya still owes hers, to a person who is no longer on the trip.
    await expect(priya.page.getByText('across 2 members')).toBeVisible(POLL)
    await expect(expenseRow(priya.page, 'Hire car')).toContainText('split 3 ways')
    await expect(priya.page.getByText('You owe $20.00')).toBeVisible()
    await expect(priya.page.getByText('You owe someone who has left the trip')).toBeVisible()

    await closeAll(priya, jonas, mia)
  })
})
