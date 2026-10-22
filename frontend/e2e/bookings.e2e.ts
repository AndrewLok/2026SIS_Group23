import { expect, test } from '@playwright/test'
import { addBooking, bookingCard, closeAll, createTrip, joinByLink, newPerson, openBookings } from './helpers.ts'

/*
 * Bookings across two people's screens. The detailed rules (who may change or delete one, what is
 * checked on the way in) are in the backend's BookingFlowTests; these check what each person sees
 * and is offered, and that a change reaches the other screen. Like the activity checks they wait up
 * to 12 seconds, because they rely on the 5 second polling.
 */

test.describe.configure({ timeout: 60_000 })

const POLL = { timeout: 12_000 }
const WHEN = '2030-06-15T12:30'
const LATER = '2030-06-15T15:00'

test.describe('bookings', () => {
  test('a booking reaches everyone, personal ones are marked, only some are offered Delete, and it shows on the calendar', async ({ browser }) => {
    const priya = await newPerson(browser, 'Priya Nair')
    const jonas = await newPerson(browser, 'Jonas Weber')
    const mia = await newPerson(browser, 'Mia Costa')
    const trip = await createTrip(priya, 'Great Ocean Road')
    await joinByLink(jonas, trip.code)
    await joinByLink(mia, trip.code)

    // Priya already has the screen open when Jonas adds his flight, so it has to arrive by itself.
    await openBookings(priya, trip.path)
    await expect(priya.page.getByText('Nothing recorded yet.')).toBeVisible()
    await openBookings(jonas, trip.path)
    await addBooking(jonas, 'JQ 610 BNE to MEL', { departs: WHEN, arrives: LATER, whose: 'Jonas Weber (you)' })
    await expect(jonas.page.getByText('Booking saved.')).toBeVisible()

    const onPriya = bookingCard(priya.page, 'JQ 610 BNE to MEL')
    await expect(onPriya).toBeVisible(POLL)
    // Marked as his, with his first name, rather than as the group's.
    await expect(onPriya).toContainText('Jonas')
    await expect(onPriya).toContainText('Departs')
    await expect(onPriya).not.toContainText('group')

    // A group booking, added by Priya.
    await addBooking(priya, 'QF 425 SYD to MEL', { departs: '2030-06-14T08:00' })
    await expect(priya.page.getByText('Booking saved.')).toBeVisible()
    await openBookings(mia, trip.path)
    const onMia = bookingCard(mia.page, 'QF 425 SYD to MEL')
    await expect(onMia).toContainText('group')

    // Who is offered Delete: the owner on both, Jonas on the one he added, Mia on neither.
    await expect(priya.page.getByRole('button', { name: 'Delete JQ 610 BNE to MEL' })).toBeVisible()
    await expect(priya.page.getByRole('button', { name: 'Delete QF 425 SYD to MEL' })).toBeVisible()
    await expect(mia.page.getByRole('button', { name: /^Delete / })).toHaveCount(0)
    await jonas.page.reload()
    await expect(jonas.page.getByRole('button', { name: 'Delete JQ 610 BNE to MEL' })).toBeVisible()
    await expect(jonas.page.getByRole('button', { name: 'Delete QF 425 SYD to MEL' })).toHaveCount(0)

    // Both are on the calendar for Mia, each on its own day, the personal one marked as personal.
    await mia.page.goto(`${trip.path}/calendar`)
    await expect(mia.page.getByRole('heading', { name: 'Fri 14 Jun' })).toBeVisible()
    await expect(mia.page.getByRole('heading', { name: 'Sat 15 Jun' })).toBeVisible()
    await expect(mia.page.getByRole('button', { name: /JQ 610 BNE to MEL/ })).toContainText('personal')
    await expect(mia.page.getByRole('button', { name: /QF 425 SYD to MEL/ })).not.toContainText('personal')
    await mia.page.getByRole('button', { name: /JQ 610 BNE to MEL/ }).click()
    const sheet = mia.page.getByRole('dialog')
    await expect(sheet).toContainText('Flight')
    await expect(sheet).toContainText('Personal booking')
    await expect(sheet.getByRole('link', { name: 'Open in bookings' })).toBeVisible()
    await mia.page.keyboard.press('Escape')

    // Jonas deletes his; it goes from Priya's open screen without her doing anything.
    await jonas.page.getByRole('button', { name: 'Delete JQ 610 BNE to MEL' }).click()
    await expect(jonas.page.getByText('Booking removed.')).toBeVisible()
    await expect(onPriya).toHaveCount(0, POLL)
    await expect(bookingCard(priya.page, 'QF 425 SYD to MEL')).toBeVisible()

    await closeAll(priya, jonas, mia)
  })

  test('two recommendations are offered, and adding one makes an ordinary booking', async ({ browser }) => {
    const priya = await newPerson(browser, 'Priya Nair')
    const trip = await createTrip(priya, 'Great Ocean Road')
    await openBookings(priya, trip.path)

    const recommended = priya.page.getByRole('region', { name: 'Recommended bookings' })
    await expect(recommended.getByRole('listitem')).toHaveCount(2)

    // Adding one opens the form filled in, and saving it is the usual booking.
    await priya.page.getByRole('button', { name: 'Add Seaview Cottage, 3 nights' }).click()
    await expect(priya.page.getByLabel('Title')).toHaveValue('Seaview Cottage, 3 nights')
    await expect(priya.page.getByLabel('Cost')).toHaveValue('1260.00')
    await priya.page.getByRole('button', { name: 'Save booking' }).click()
    await expect(priya.page.getByText('Booking saved.')).toBeVisible()
    await expect(bookingCard(priya.page, 'Seaview Cottage, 3 nights')).toContainText('$1,260.00')

    // It is no longer suggested, and the other one still is.
    await expect(recommended.getByRole('button', { name: 'Add Seaview Cottage, 3 nights' })).toHaveCount(0)
    await expect(recommended.getByRole('button', { name: 'Add Compact SUV hire, 4 days' })).toBeVisible()

    await closeAll(priya)
  })

  test('a refused booking says why, and what is typed stops at the limit', async ({ browser }) => {
    const priya = await newPerson(browser, 'Priya Nair')
    const trip = await createTrip(priya, 'Great Ocean Road')
    await openBookings(priya, trip.path)

    // It cannot arrive before it leaves: the server's own words, and the drawer stays open.
    await addBooking(priya, 'QF 425', { departs: LATER, arrives: WHEN })
    await expect(priya.page.getByText('It cannot end before it starts.')).toBeVisible()
    await expect(priya.page.getByRole('button', { name: 'Save booking' })).toBeVisible()
    await expect(priya.page.getByText('Nothing recorded yet.')).toBeVisible()

    // Put right, the same form saves.
    await priya.page.getByLabel('Arrives').fill('2030-06-15T18:00')
    await priya.page.getByRole('button', { name: 'Save booking' }).click()
    await expect(priya.page.getByText('Booking saved.')).toBeVisible()
    await expect(bookingCard(priya.page, 'QF 425')).toBeVisible()

    // The title stops at 100 characters, which is the server's limit.
    await priya.page.getByRole('button', { name: 'Add booking' }).click()
    const title = priya.page.getByLabel('Flight number')
    await title.fill('x'.repeat(150))
    await expect(title).toHaveValue('x'.repeat(100))

    await closeAll(priya)
  })

  test('someone who leaves takes their own bookings with them and leaves the group’s', async ({ browser }) => {
    const priya = await newPerson(browser, 'Priya Nair')
    const jonas = await newPerson(browser, 'Jonas Weber')
    const trip = await createTrip(priya, 'Great Ocean Road')
    await joinByLink(jonas, trip.code)

    await openBookings(jonas, trip.path)
    await addBooking(jonas, 'Jonas flight', { departs: WHEN, whose: 'Jonas Weber (you)' })
    await expect(jonas.page.getByText('Booking saved.')).toBeVisible()
    await addBooking(jonas, 'Group stay')
    await expect(bookingCard(jonas.page, 'Group stay')).toBeVisible()

    await openBookings(priya, trip.path)
    await expect(bookingCard(priya.page, 'Jonas flight')).toBeVisible()

    await jonas.page.goto(`${trip.path}/members`)
    await jonas.page.getByRole('button', { name: 'Leave this trip' }).click()
    await jonas.page.getByRole('button', { name: 'Leave trip' }).click()
    await expect(jonas.page).toHaveURL(/\/trips$/)

    await expect(bookingCard(priya.page, 'Jonas flight')).toHaveCount(0, POLL)
    await expect(bookingCard(priya.page, 'Group stay')).toBeVisible()

    await closeAll(priya, jonas)
  })
})
