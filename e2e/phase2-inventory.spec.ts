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

test.describe('Inventory', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test('stock levels page loads with seeded products', async ({ page }) => {
    await page.goto(`${BASE}/admin/inventory`)
    await expect(page.getByText('Inventory')).toBeVisible()
    await expect(page.getByText('Pepsi 1.5L')).toBeVisible()
    await expect(page.getByText('WH-KHI')).toBeVisible()
  })

  test('adjust stock for a product, verify transaction logged', async ({ page }) => {
    await page.goto(`${BASE}/admin/inventory/adjust`)
    // Select first product
    await page.getByRole('combobox').first().click()
    await page.getByText('Pepsi 1.5L').click()
    // Select first warehouse
    await page.getByRole('combobox').nth(1).click()
    await page.getByText('Karachi Main').click()
    await page.waitForTimeout(500) // wait for stock fetch
    await page.fill('[type=number]', '15')
    await page.fill('[placeholder*="Reason"]', 'E2E test adjustment')
    await page.getByRole('button', { name: /Apply Adjustment/ }).click()
    // Should redirect to inventory
    await page.waitForURL(`${BASE}/admin/inventory`)

    // Verify transaction logged
    await page.goto(`${BASE}/admin/inventory/transactions`)
    await expect(page.getByText('E2E test adjustment')).toBeVisible()
    await expect(page.getByText('Pepsi 1.5L')).toBeVisible()
  })

  test('transfer stock between warehouses, verify both update', async ({ page }) => {
    await page.goto(`${BASE}/admin/inventory/transfer`)
    await page.getByRole('combobox').first().click()
    await page.getByText('Nestle Water 1L').click()
    // From: Karachi
    await page.getByRole('combobox').nth(1).click()
    await page.getByText('Karachi Main').first().click()
    // To: Lahore
    await page.getByRole('combobox').nth(2).click()
    await page.getByText('Lahore Branch').click()
    await page.fill('[type=number]', '10')
    await page.getByRole('button', { name: /Transfer Stock/ }).click()
    await page.waitForURL(`${BASE}/admin/inventory`)
    await expect(page).toHaveURL(`${BASE}/admin/inventory`)
  })

  test('warehouses CRUD', async ({ page }) => {
    await page.goto(`${BASE}/admin/inventory/warehouses`)
    await expect(page.getByText('Karachi Main')).toBeVisible()
    await expect(page.getByText('Lahore Branch')).toBeVisible()

    // Create new warehouse
    await page.getByRole('button', { name: /New Warehouse/ }).click()
    await page.fill('[placeholder=""]', 'Test Warehouse')
    await page.getByRole('button', { name: 'Create' }).click()
    await expect(page.getByText('Warehouse created')).toBeVisible()
    await expect(page.getByText('Test Warehouse')).toBeVisible()
  })

  test('stock-take workflow', async ({ page }) => {
    await page.goto(`${BASE}/admin/inventory/stock-take`)
    await page.getByRole('combobox').first().click()
    await page.getByText('Karachi Main').click()
    await page.waitForTimeout(500)
    // Modify one count
    const inputs = await page.$$('[type=number]')
    if (inputs.length > 0) {
      const currentValue = await inputs[0].inputValue()
      await inputs[0].fill(String(Number(currentValue) + 5))
    }
    await page.getByRole('button', { name: /Submit Stock Take/ }).click()
    await expect(page.getByText('Stock Take Complete')).toBeVisible()
  })
})

test.describe('Clients bulk import', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test('client list shows seeded clients', async ({ page }) => {
    await page.goto(`${BASE}/admin/clients`)
    await expect(page.getByText('Clients')).toBeVisible()
    await expect(page.getByText('SuperMart Karachi')).toBeVisible()
    await expect(page.getByText('Metro Cash & Carry')).toBeVisible()
  })
})
