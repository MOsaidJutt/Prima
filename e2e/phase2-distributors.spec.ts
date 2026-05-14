import { test, expect } from '@playwright/test'

const BASE = 'http://techcorp-pvt.localhost:3000'
const ADMIN = { email: 'admin@techcorp.pk', password: 'Admin@123' }

async function login(page: import('@playwright/test').Page) {
  await page.goto(`${BASE}/login`)
  await page.fill('[name=email]', ADMIN.email)
  await page.fill('[name=password]', ADMIN.password)
  await page.click('[type=submit]')
  await page.waitForURL(`${BASE}/admin`)
}

test.describe('Distributors', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test('list page loads with seeded data', async ({ page }) => {
    await page.goto(`${BASE}/admin/distributors`)
    await expect(page.getByText('Distributors')).toBeVisible()
    await expect(page.getByText('Alpha Trading Co')).toBeVisible()
    await expect(page.getByText('DST-0001')).toBeVisible()
  })

  test('create distributor with full details and verify in list', async ({ page }) => {
    await page.goto(`${BASE}/admin/distributors/new`)
    await page.fill('[name=companyName]', 'E2E Test Distributor')
    await page.fill('[name=contactName]', 'Test Contact')
    await page.fill('[name=email]', 'e2e@testdist.pk')
    await page.fill('[name=phone]', '+92-300-9999999')
    await page.fill('[name=city]', 'Karachi')
    await page.fill('[name=creditLimit]', '250000')
    await page.fill('[name=paymentTerms]', '45')
    await page.click('[type=submit]')

    // Should redirect to detail page
    await page.waitForURL(/\/admin\/distributors\/[a-z0-9-]+/)
    await expect(page.getByText('E2E Test Distributor')).toBeVisible()
    await expect(page.getByText('DST-')).toBeVisible()

    // Verify appears in list
    await page.goto(`${BASE}/admin/distributors`)
    await expect(page.getByText('E2E Test Distributor')).toBeVisible()
  })

  test('search filters distributors', async ({ page }) => {
    await page.goto(`${BASE}/admin/distributors`)
    await page.fill('[placeholder*="Search"]', 'Alpha')
    await page.waitForTimeout(600) // debounce
    await expect(page.getByText('Alpha Trading Co')).toBeVisible()
    await expect(page.getByText('Beta Distributors')).not.toBeVisible()
  })

  test('edit distributor', async ({ page }) => {
    await page.goto(`${BASE}/admin/distributors`)
    await page.getByText('Alpha Trading Co').click()
    await page.waitForURL(/\/admin\/distributors\/[a-z0-9-]+/)
    await page.getByRole('link', { name: /Edit/ }).click()
    await page.waitForURL(/\/admin\/distributors\/[a-z0-9-]+\/edit/)
    await page.fill('[name=notes]', 'Updated via E2E test')
    await page.click('[type=submit]')
    await page.waitForURL(/\/admin\/distributors\/[a-z0-9-]+/)
    // Success toast or redirect indicates success
    await expect(page).toHaveURL(/\/admin\/distributors\/[a-z0-9-]+/)
  })
})
