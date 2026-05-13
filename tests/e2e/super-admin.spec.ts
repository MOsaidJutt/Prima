import { test, expect } from '@playwright/test'

const SA_EMAIL = process.env.SUPER_ADMIN_EMAIL ?? 'admin@prima.app'
const SA_PASSWORD = process.env.SUPER_ADMIN_PASSWORD ?? 'SuperAdmin@123'

test.describe('Super Admin', () => {
  test('login page renders', async ({ page }) => {
    await page.goto('/super-admin/login')
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
    await expect(page.getByLabel('Email')).toBeVisible()
    await expect(page.getByLabel('Password')).toBeVisible()
  })

  test('redirects to login when not authenticated', async ({ page }) => {
    await page.goto('/super-admin/dashboard')
    await expect(page).toHaveURL('/super-admin/login')
  })

  test('logs in with valid credentials and lands on dashboard', async ({ page }) => {
    await page.goto('/super-admin/login')
    await page.getByLabel('Email').fill(SA_EMAIL)
    await page.getByLabel('Password').fill(SA_PASSWORD)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page).toHaveURL('/super-admin/dashboard')
    await expect(page.getByRole('heading', { name: 'Platform Dashboard' })).toBeVisible()
  })

  test('can navigate to organizations page', async ({ page }) => {
    // Login first
    await page.goto('/super-admin/login')
    await page.getByLabel('Email').fill(SA_EMAIL)
    await page.getByLabel('Password').fill(SA_PASSWORD)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await page.waitForURL('/super-admin/dashboard')

    await page.getByRole('link', { name: 'Organizations' }).click()
    await expect(page).toHaveURL('/super-admin/organizations')
    await expect(page.getByRole('heading', { name: 'Organizations' })).toBeVisible()
  })

  test('can navigate to new organization form', async ({ page }) => {
    await page.goto('/super-admin/login')
    await page.getByLabel('Email').fill(SA_EMAIL)
    await page.getByLabel('Password').fill(SA_PASSWORD)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await page.waitForURL('/super-admin/dashboard')

    await page.goto('/super-admin/organizations/new')
    await expect(page.getByRole('heading', { name: 'New Organization' })).toBeVisible()
  })
})

test.describe('Onboarding', () => {
  test('onboarding wizard renders step 1', async ({ page }) => {
    await page.goto('/onboarding')
    await expect(page.getByText('Organization Profile')).toBeVisible()
    await expect(page.getByText('Branding')).toBeVisible()
    await expect(page.getByText('First Department')).toBeVisible()
    await expect(page.getByText('Invite Team')).toBeVisible()
  })
})
