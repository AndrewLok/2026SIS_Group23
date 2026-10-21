import { expect, test } from '@playwright/test'
import { closeAll, createTrip, joinByLink, newPerson, openChat, PASSWORD } from './helpers.ts'

/*
 * What happens when things do not go to plan: the session ends under you, a request is refused,
 * text is too long, the person is in another time zone. The permission rules and the exact limits
 * are pinned down on the Java side; these check that the screens say and do the right thing.
 */

test.describe('when the session ends', () => {
  test('the next action sends you to sign in with a reason, and signing in puts you back', async ({ browser }) => {
    const priya = await newPerson(browser, 'Priya Nair')
    const trip = await createTrip(priya, 'Great Ocean Road')
    await openChat(priya, trip.path)

    // The server stops recognising her. A session that ran out looks exactly like a browser that
    // no longer has the cookie, as far as the app can tell.
    await priya.context.clearCookies()
    const box = priya.page.getByLabel('Message')
    await box.fill('Are we still on?')
    await box.press('Enter')

    await expect(priya.page).toHaveURL(/\/login$/)
    await expect(priya.page.getByRole('status')).toContainText('Your session ended')

    await priya.page.getByLabel('Email').fill(priya.email)
    await priya.page.getByLabel('Password').fill(PASSWORD)
    await priya.page.getByRole('button', { name: 'Sign in' }).click()
    // Back where she was, and the notice is gone.
    await expect(priya.page).toHaveURL(`${trip.path}/chat`)
    await expect(priya.page.getByLabel('Message')).toBeVisible()
    await expect(priya.page.getByRole('status').filter({ hasText: 'Your session ended' })).toHaveCount(0)

    await closeAll(priya)
  })

  test('a wrong password on the sign-in screen is still just a wrong password', async ({ browser }) => {
    const sam = await newPerson(browser, 'Sam Rivera')
    await sam.page.getByRole('button', { name: 'Sign out' }).click()
    await expect(sam.page).toHaveURL(/\/login$/)

    await sam.page.getByLabel('Email').fill(sam.email)
    await sam.page.getByLabel('Password').fill('not-the-password')
    await sam.page.getByRole('button', { name: 'Sign in' }).click()

    await expect(sam.page.getByRole('alert')).toContainText('do not match')
    // Signing out yourself, or being refused a password, is not "your session ended".
    await expect(sam.page.getByRole('status').filter({ hasText: 'Your session ended' })).toHaveCount(0)

    await closeAll(sam)
  })
})

test.describe('invite links and sign-in', () => {
  test('an invite link opened while signed out comes back to the invite after signing in', async ({ browser }) => {
    const priya = await newPerson(browser, 'Priya Nair')
    const jonas = await newPerson(browser, 'Jonas Weber')
    const trip = await createTrip(priya, 'Great Ocean Road')
    await jonas.page.getByRole('button', { name: 'Sign out' }).click()
    await expect(jonas.page).toHaveURL(/\/login$/)

    await jonas.page.goto(`/join/${trip.code}`)
    await expect(jonas.page).toHaveURL(/\/login$/)
    await jonas.page.getByLabel('Email').fill(jonas.email)
    await jonas.page.getByLabel('Password').fill(PASSWORD)
    await jonas.page.getByRole('button', { name: 'Sign in' }).click()

    await expect(jonas.page).toHaveURL(`/join/${trip.code}`)
    await expect(jonas.page.getByRole('button', { name: 'Join this trip' })).toBeVisible()

    await closeAll(priya, jonas)
  })
})

test.describe('trip dates', () => {
  test('the days picked are the days shown, in a time zone west of UTC', async ({ browser }) => {
    // Midnight UTC on the 8th is still the evening of the 7th here, which is what used to show.
    const priya = await newPerson(browser, 'Priya Nair', { timezoneId: 'America/Los_Angeles' })
    await createTrip(priya, 'Great Ocean Road') // Starts 2026-11-08, ends 2026-11-15

    await priya.page.goto('/trips')
    await expect(priya.page.getByText('8 - 15 Nov 2026')).toBeVisible()

    await closeAll(priya)
  })

  test('and in a time zone far east of UTC', async ({ browser }) => {
    const priya = await newPerson(browser, 'Priya Nair', { timezoneId: 'Pacific/Auckland' })
    await createTrip(priya, 'Great Ocean Road')

    await priya.page.goto('/trips')
    await expect(priya.page.getByText('8 - 15 Nov 2026')).toBeVisible()

    await closeAll(priya)
  })

  test('someone a few hours away sees the same days', async ({ browser }) => {
    const priya = await newPerson(browser, 'Priya Nair', { timezoneId: 'America/Los_Angeles' })
    const jonas = await newPerson(browser, 'Jonas Weber', { timezoneId: 'America/New_York' })
    const trip = await createTrip(priya, 'Great Ocean Road')
    await joinByLink(jonas, trip.code)

    await jonas.page.goto('/trips')
    await expect(jonas.page.getByText('8 - 15 Nov 2026')).toBeVisible()

    await closeAll(priya, jonas)
  })
})

test.describe('length limits', () => {
  test('the sign-up and trip forms stop typing at the limits the server enforces', async ({ browser }) => {
    const page = await (await browser.newContext()).newPage()
    await page.goto('/login')
    await page.getByRole('button', { name: 'Create one' }).click()
    await page.getByLabel('Display name').pressSequentially('n'.repeat(70))
    expect((await page.getByLabel('Display name').inputValue()).length).toBe(60)
    await page.context().close()

    const priya = await newPerson(browser, 'Priya Nair')
    await priya.page.goto('/trips')
    await priya.page.getByRole('button', { name: 'New trip' }).click()
    await priya.page.getByLabel('Trip name').pressSequentially('t'.repeat(110))
    expect((await priya.page.getByLabel('Trip name').inputValue()).length).toBe(100)
    await priya.page.getByLabel('Destination').pressSequentially('d'.repeat(110))
    expect((await priya.page.getByLabel('Destination').inputValue()).length).toBe(100)

    await closeAll(priya)
  })

  test('the server refuses over-long text with a message, not a clash, if it gets that far', async ({ browser }) => {
    const priya = await newPerson(browser, 'Priya Nair')

    const name = await priya.page.request.post('/api/auth/register', {
      data: { displayName: 'n'.repeat(61), email: `long-${Date.now()}@example.com`, password: PASSWORD },
    })
    expect(name.status()).toBe(400)
    expect(await name.json()).toMatchObject({ code: 'invalid' })
    expect((await name.json()).message).toContain('too long')

    const trip = await priya.page.request.post('/api/trips', { data: { name: 't'.repeat(101) } })
    expect(trip.status()).toBe(400)
    expect(await trip.json()).toMatchObject({ code: 'invalid' })

    await closeAll(priya)
  })
})

test.describe('refusals are shown, not swallowed', () => {
  test('a message the server refuses stays in the box and the reason is shown', async ({ browser }) => {
    const priya = await newPerson(browser, 'Priya Nair')
    const trip = await createTrip(priya, 'Great Ocean Road')
    await openChat(priya, trip.path)
    await priya.page.route('**/api/channels/*/messages', async (route) => {
      if (route.request().method() !== 'POST') return route.continue()
      return route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ code: 'invalid', message: 'That message is too long. Keep it under 2000 characters.' }),
      })
    })

    const box = priya.page.getByLabel('Message')
    await box.fill('A very long message')
    await box.press('Enter')

    await expect(priya.page.getByText('That message is too long. Keep it under 2000 characters.')).toBeVisible()
    await expect(box).toHaveValue('A very long message')

    await closeAll(priya)
  })

  test('a message that cannot be sent because the server is down says so and keeps the text', async ({ browser }) => {
    const priya = await newPerson(browser, 'Priya Nair')
    const trip = await createTrip(priya, 'Great Ocean Road')
    await openChat(priya, trip.path)
    await priya.page.route('**/api/channels/*/messages', (route) =>
      route.request().method() === 'POST' ? route.abort('connectionrefused') : route.continue(),
    )

    const box = priya.page.getByLabel('Message')
    await box.fill('Are we still on?')
    await box.press('Enter')

    await expect(priya.page.getByText('Could not reach the server')).toBeVisible()
    await expect(box).toHaveValue('Are we still on?')

    await closeAll(priya)
  })

  test('a refused new code says why', async ({ browser }) => {
    const priya = await newPerson(browser, 'Priya Nair')
    const trip = await createTrip(priya, 'Great Ocean Road')
    await priya.page.goto(`${trip.path}/members`)
    await priya.page.route('**/regenerate-code', (route) =>
      route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({ code: 'forbidden', message: 'Only the trip owner can make a new code.' }),
      }),
    )

    await priya.page.getByRole('button', { name: 'Regenerate' }).click()

    await expect(priya.page.getByText('Only the trip owner can make a new code.')).toBeVisible()

    await closeAll(priya)
  })
})
