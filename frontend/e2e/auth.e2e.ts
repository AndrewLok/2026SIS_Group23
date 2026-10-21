import { expect, test } from '@playwright/test'
import { closeAll, fillSignUp, newPerson, PASSWORD, uniqueEmail } from './helpers.ts'

test.describe('signing in and out', () => {
  test('a new account lands on the trip list and stays signed in after a reload', async ({ browser }) => {
    const sam = await newPerson(browser, 'Sam Rivera')

    await sam.page.reload()
    await expect(sam.page.getByText('Signed in as Sam Rivera')).toBeVisible()
    await expect(sam.page).toHaveURL(/\/trips$/)

    await closeAll(sam)
  })

  test('signing out ends the session, and the same details sign back in', async ({ browser }) => {
    const sam = await newPerson(browser, 'Sam Rivera')
    const { page } = sam

    await page.getByRole('button', { name: 'Sign out' }).click()
    await expect(page).toHaveURL(/\/login$/)

    // The cookie is gone: a protected page sends you back to the login form.
    await page.goto('/trips')
    await expect(page).toHaveURL(/\/login$/)

    await page.getByLabel('Email').fill(sam.email)
    await page.getByLabel('Password').fill(PASSWORD)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page).toHaveURL(/\/trips$/)
    await expect(page.getByText('Signed in as Sam Rivera')).toBeVisible()

    await closeAll(sam)
  })

  test('a wrong password is refused with the backend message and nobody is signed in', async ({ browser }) => {
    const sam = await newPerson(browser, 'Sam Rivera')
    await sam.page.getByRole('button', { name: 'Sign out' }).click()
    await expect(sam.page).toHaveURL(/\/login$/)

    await sam.page.getByLabel('Email').fill(sam.email)
    await sam.page.getByLabel('Password').fill('not-the-password')
    await sam.page.getByRole('button', { name: 'Sign in' }).click()

    await expect(sam.page.getByRole('alert')).toHaveText('That email and password do not match.')
    await expect(sam.page).toHaveURL(/\/login$/)

    await closeAll(sam)
  })

  test('an email that already has an account is refused', async ({ browser }) => {
    const sam = await newPerson(browser, 'Sam Rivera')

    const other = await browser.newContext()
    const page = await other.newPage()
    await fillSignUp(page, 'Someone Else', sam.email)

    await expect(page.getByRole('alert')).toHaveText('There is already an account with that email.')
    await expect(page).toHaveURL(/\/login$/)

    await other.close()
    await closeAll(sam)
  })

  test('someone who never signed up cannot sign in', async ({ browser }) => {
    const context = await browser.newContext()
    const page = await context.newPage()

    await page.goto('/login')
    await page.getByLabel('Email').fill(uniqueEmail('Nobody'))
    await page.getByLabel('Password').fill(PASSWORD)
    await page.getByRole('button', { name: 'Sign in' }).click()

    await expect(page.getByRole('alert')).toHaveText('That email and password do not match.')

    await context.close()
  })
})
