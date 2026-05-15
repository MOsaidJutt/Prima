import { test, expect } from '@playwright/test'

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function loginAdmin(
  page: Parameters<typeof test>[1] extends (arg: infer T, ...args: unknown[]) => unknown
    ? never
    : import('@playwright/test').Page
) {
  await page.goto('/login')
  await page.fill('input[type="email"]', process.env.TEST_ADMIN_EMAIL ?? 'admin@demo.prima.app')
  await page.fill('input[type="password"]', process.env.TEST_ADMIN_PASSWORD ?? 'Admin1234!')
  await page.click('button[type="submit"]')
  await page.waitForURL('/admin')
}

async function loginSalesRep(page: import('@playwright/test').Page) {
  await page.goto('/login')
  await page.fill('input[type="email"]', process.env.TEST_REP_EMAIL ?? 'rep@demo.prima.app')
  await page.fill('input[type="password"]', process.env.TEST_REP_PASSWORD ?? 'Rep12345!')
  await page.click('button[type="submit"]')
  await page.waitForURL('/dashboard')
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test.describe('Phase 4 — Dashboards', () => {
  test('Admin sees executive dashboard with KPIs populated', async ({ page }) => {
    await loginAdmin(page)
    await expect(page).toHaveURL('/admin')
    // KPI cards should be visible
    await expect(page.getByText('Revenue')).toBeVisible()
    await expect(page.getByText('Active Clients')).toBeVisible()
    await expect(page.getByText('Pending DSRs')).toBeVisible()
    await expect(page.getByText('Outstanding')).toBeVisible()
    // Revenue trend chart should load
    await expect(page.getByText('Revenue Trend')).toBeVisible()
    // Invoice status donut
    await expect(page.getByText('Invoice Status')).toBeVisible()
    // Top reps leaderboard
    await expect(page.getByText('Top Sales Reps')).toBeVisible()
  })

  test('Admin can apply date filter and data updates', async ({ page }) => {
    await loginAdmin(page)
    const fromInput = page.locator('input[type="date"]').first()
    const toInput = page.locator('input[type="date"]').nth(1)

    const firstMonth = new Date()
    firstMonth.setDate(1)
    const today = new Date()

    await fromInput.fill(firstMonth.toISOString().slice(0, 10))
    await toInput.fill(today.toISOString().slice(0, 10))
    // Page should reload (URL params change)
    await page.waitForURL(/from=/)
    // Dashboard content should still be visible
    await expect(page.getByText('Revenue')).toBeVisible()
  })

  test('Sales dashboard loads with correct widgets', async ({ page }) => {
    await loginAdmin(page)
    await page.goto('/admin/dashboards/sales')
    await expect(page.getByText('Sales Dashboard')).toBeVisible()
    await expect(page.getByText('Total Revenue')).toBeVisible()
    await expect(page.getByText('DSRs Submitted')).toBeVisible()
    await expect(page.getByText('Conversion Rate')).toBeVisible()
    await expect(page.getByText('Daily Revenue')).toBeVisible()
    await expect(page.getByText('Visits by Type')).toBeVisible()
    await expect(page.getByText('Top Reps by Revenue')).toBeVisible()
    await expect(page.getByText('Top Clients')).toBeVisible()
  })

  test('Financial dashboard loads with AR aging chart', async ({ page }) => {
    await loginAdmin(page)
    await page.goto('/admin/dashboards/financial')
    await expect(page.getByText('Financial Dashboard')).toBeVisible()
    await expect(page.getByText('Invoiced')).toBeVisible()
    await expect(page.getByText('Collected')).toBeVisible()
    await expect(page.getByText('Cash Flow')).toBeVisible()
    await expect(page.getByText('AR Aging')).toBeVisible()
    await expect(page.getByText('Collection Rate')).toBeVisible()
    await expect(page.getByText('Payment Methods')).toBeVisible()
  })

  test('Inventory dashboard shows stock alerts', async ({ page }) => {
    await loginAdmin(page)
    await page.goto('/admin/dashboards/inventory')
    await expect(page.getByText('Inventory Dashboard')).toBeVisible()
    await expect(page.getByText('Active Products')).toBeVisible()
    await expect(page.getByText('Total Stock Units')).toBeVisible()
    await expect(page.getByText('Low Stock Alerts')).toBeVisible()
    await expect(page.getByText('Stock by Category')).toBeVisible()
  })

  test('EPR dashboard shows team performance table', async ({ page }) => {
    await loginAdmin(page)
    await page.goto('/admin/dashboards/epr')
    await expect(page.getByText('Employee Performance Reports')).toBeVisible()
    await expect(page.getByText('Active Reps')).toBeVisible()
    await expect(page.getByText('Top Performers')).toBeVisible()
    await expect(page.getByText('All Reps')).toBeVisible()
  })

  test('Sales rep sees only their own data on /dashboard', async ({ page }) => {
    await loginSalesRep(page)
    await expect(page).toHaveURL('/dashboard')
    await expect(page.getByText('My Dashboard')).toBeVisible()
    await expect(page.getByText('DSRs Submitted')).toBeVisible()
    await expect(page.getByText('Revenue')).toBeVisible()
    // Should NOT see admin-level KPIs
    await expect(page.getByText('Team Size')).not.toBeVisible()
    await expect(page.getByText('Pending Approvals')).not.toBeVisible()
  })

  test('Manager sees team data on /manager', async ({ page }) => {
    // Log in as manager-role user
    await page.goto('/login')
    await page.fill(
      'input[type="email"]',
      process.env.TEST_MANAGER_EMAIL ?? 'manager@demo.prima.app'
    )
    await page.fill('input[type="password"]', process.env.TEST_MANAGER_PASSWORD ?? 'Manager1!')
    await page.click('button[type="submit"]')
    await page.waitForURL('/manager')
    await expect(page.getByText('Manager Dashboard')).toBeVisible()
    await expect(page.getByText('Pending Approvals')).toBeVisible()
    await expect(page.getByText('Team Revenue')).toBeVisible()
    await expect(page.getByText('Team Performance')).toBeVisible()
  })

  test('Export button is present on dashboards', async ({ page }) => {
    await loginAdmin(page)
    // Executive dashboard
    await expect(page.getByRole('button', { name: /export/i }).first()).toBeVisible()

    // Sales dashboard
    await page.goto('/admin/dashboards/sales')
    await expect(page.getByRole('button', { name: /export/i })).toBeVisible()
  })

  test('Export CSV downloads file', async ({ page }) => {
    await loginAdmin(page)
    await page.goto('/admin/dashboards/sales')
    // Click export dropdown
    await page.getByRole('button', { name: /export/i }).click()
    // Wait for dropdown to open
    const downloadPromise = page.waitForEvent('download')
    await page.getByText('CSV').click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toMatch(/\.csv$/)
  })

  test('Distributor dashboard loads', async ({ page }) => {
    await loginAdmin(page)
    await page.goto('/admin/dashboards/distributors')
    await expect(page.getByText('Distributor Overview')).toBeVisible()
    await expect(page.getByText('Total Distributors')).toBeVisible()
    await expect(page.getByText('By Tier')).toBeVisible()
    await expect(page.getByText('Distributor List')).toBeVisible()
  })

  test('Clients dashboard loads', async ({ page }) => {
    await loginAdmin(page)
    await page.goto('/admin/dashboards/clients')
    await expect(page.getByText('Client Overview')).toBeVisible()
    await expect(page.getByText('Total Clients')).toBeVisible()
    await expect(page.getByText('By Business Type')).toBeVisible()
    await expect(page.getByText('Top Clients by Lifetime Value')).toBeVisible()
  })

  test('Filter reset button clears filters', async ({ page }) => {
    await loginAdmin(page)
    const fromInput = page.locator('input[type="date"]').first()
    await fromInput.fill('2024-01-01')
    await page.waitForURL(/from=/)
    await page.getByRole('button', { name: /reset/i }).click()
    await page.waitForURL('/admin')
    // URL should have no filter params
    expect(page.url()).not.toContain('from=')
  })
})
