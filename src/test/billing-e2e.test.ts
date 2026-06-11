// @vitest-environment node
/**
 * Phase 6 platform billing E2E tests — exercise the billing lib functions
 * directly against a real database to validate the core lifecycle flows
 * described in Prima_Pricing_Strategy.md:
 *
 *   1. Trial -> upgrade -> token top-up
 *   2. Failed renewal -> PAST_DUE -> feature restriction -> SUSPENDED
 *   3. Auto-top-up triggered when remaining tokens cross the threshold
 *   4. Plan downgrade pro-ration (credit applied, no charge)
 *
 * These tests call `src/lib/billing/*` and `src/lib/ai/wallet.ts` exports
 * directly (the same functions used by the tenant billing API routes and the
 * subscription-lifecycle worker) rather than driving a browser, since the
 * scenarios are backend business-logic flows.
 *
 * Orgs created here have no saved payment method, so all charges go through
 * the MANUAL provider, which always returns `{ status: 'PENDING' }` —
 * matching the real default for self-service signups (a Super Admin
 * reconciles these payments later via the org billing page).
 *
 * Set SKIP_INTEGRATION_TESTS=1 to skip these if the test database is unavailable.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '@/lib/prisma'
import {
  convertTrialToPaid,
  changePlan,
  chargeSubscriptionRenewal,
  markPastDue,
  markSuspended,
  isFeatureRestricted,
  isReadOnly,
} from '@/lib/billing/subscription'
import { purchaseTopUp } from '@/lib/billing/topup'
import { logTokenUsage, ensureWalletExists } from '@/lib/ai/wallet'
import { getBillingPlan, planMonthlyEquivalent } from '@/lib/billing/plans'
import { calculateProration } from '@/lib/billing/proration'
import { DEFAULT_AUTO_TOPUP_PACK_NAME } from '@/lib/billing/constants'

const SKIP = process.env.SKIP_INTEGRATION_TESTS === '1' || !process.env.DATABASE_URL

const SLUGS = [
  'test-billing-trial-e2e',
  'test-billing-pastdue-e2e',
  'test-billing-autotopup-e2e',
  'test-billing-downgrade-e2e',
]

async function cleanup() {
  await prisma.tokenUsageLog.deleteMany({ where: { organization: { slug: { in: SLUGS } } } })
  await prisma.tokenTopUpOrder.deleteMany({ where: { organization: { slug: { in: SLUGS } } } })
  await prisma.platformPayment.deleteMany({ where: { organization: { slug: { in: SLUGS } } } })
  await prisma.tokenWallet.deleteMany({ where: { organization: { slug: { in: SLUGS } } } })
  await prisma.notification.deleteMany({ where: { organization: { slug: { in: SLUGS } } } })
  await prisma.auditLog.deleteMany({ where: { organization: { slug: { in: SLUGS } } } })
  await prisma.organization.deleteMany({ where: { slug: { in: SLUGS } } })
}

beforeAll(async () => {
  if (SKIP) return
  await cleanup()
})

afterAll(async () => {
  if (SKIP) return
  await cleanup()
})

describe('Billing E2E: trial -> upgrade -> top-up', () => {
  let orgId: string

  it.skipIf(SKIP)('creates a TRIAL organization', async () => {
    const org = await prisma.organization.create({
      data: {
        slug: 'test-billing-trial-e2e',
        name: 'Test Billing Trial Org',
        email: 'trial@billing-e2e.test',
        status: 'TRIAL',
        plan: 'STARTER',
        trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        setupFeePaid: false,
      },
    })
    orgId = org.id
    expect(org.status).toBe('TRIAL')
  })

  it.skipIf(SKIP)('convertTrialToPaid activates the org on the PRO plan', async () => {
    const proPlan = await getBillingPlan('PRO')
    const charges = await convertTrialToPaid(orgId, { tier: 'PRO', billingCycle: 'MONTHLY' })

    // Starter setup fee not yet paid -> first conversion includes the setup fee.
    expect(charges.setupFee).toBeGreaterThan(0)
    expect(charges.total).toBeGreaterThan(0)

    const org = await prisma.organization.findUniqueOrThrow({ where: { id: orgId } })
    expect(org.status).toBe('ACTIVE')
    expect(org.plan).toBe('PRO')
    expect(org.aiEnabled).toBe(proPlan.aiEnabled)
    expect(org.monthlyTokenBudget).toBe(proPlan.aiTokensIncluded)
    expect(org.setupFeePaid).toBe(true)
    expect(org.nextBillingDate).not.toBeNull()

    // MANUAL provider (no saved card) always returns PENDING — recorded for
    // a Super Admin to reconcile, but the org is activated immediately.
    const payments = await prisma.platformPayment.findMany({ where: { organizationId: orgId } })
    expect(payments.some((p) => p.type === 'SUBSCRIPTION' && p.status === 'PENDING')).toBe(true)
    expect(payments.some((p) => p.type === 'SETUP_FEE' && p.status === 'PENDING')).toBe(true)
  })

  it.skipIf(SKIP)('changePlan upgrades to BUSINESS and charges a positive proration', async () => {
    const result = await changePlan(orgId, { newTier: 'BUSINESS' })
    const businessPlan = await getBillingPlan('BUSINESS')

    expect(result.proration).not.toBeNull()
    // Upgrading mid-cycle to a more expensive plan owes money immediately.
    expect(result.proration!.netAmount).toBeGreaterThan(0)

    const org = await prisma.organization.findUniqueOrThrow({ where: { id: orgId } })
    expect(org.plan).toBe('BUSINESS')
    expect(org.monthlyTokenBudget).toBe(businessPlan.aiTokensIncluded)

    const adjustment = await prisma.platformPayment.findFirst({
      where: { organizationId: orgId, type: 'MANUAL_ADJUSTMENT' },
    })
    expect(adjustment).not.toBeNull()
    expect(adjustment!.status).toBe('PENDING')
    expect(Number(adjustment!.amount)).toBeCloseTo(result.proration!.netAmount, 2)
  })

  it.skipIf(SKIP)('purchaseTopUp records a pending top-up order via MANUAL provider', async () => {
    const standardPack = await prisma.tokenTopUpPack.findFirstOrThrow({
      where: { name: DEFAULT_AUTO_TOPUP_PACK_NAME },
    })

    const order = await purchaseTopUp({ organizationId: orgId, packId: standardPack.id })

    expect(order.status).toBe('PENDING')
    expect(order.tokens).toBe(standardPack.tokens)
    expect(order.isAutoTopUp).toBe(false)
    expect(order.provider).toBe('MANUAL')

    const payment = await prisma.platformPayment.findFirst({
      where: { organizationId: orgId, type: 'TOPUP', topUpOrderId: order.id },
    })
    expect(payment).not.toBeNull()
    expect(payment!.status).toBe('PENDING')

    // Wallet is only credited once the payment is reconciled as SUCCEEDED.
    const wallet = await prisma.tokenWallet.findUnique({ where: { organizationId: orgId } })
    expect(wallet?.balance ?? 0).toBe(0)
  })
})

describe('Billing E2E: failed renewal -> PAST_DUE -> SUSPENDED', () => {
  let orgId: string

  it.skipIf(SKIP)('creates an ACTIVE org with an overdue billing date', async () => {
    const org = await prisma.organization.create({
      data: {
        slug: 'test-billing-pastdue-e2e',
        name: 'Test Billing Past-Due Org',
        email: 'pastdue@billing-e2e.test',
        status: 'ACTIVE',
        plan: 'PRO',
        billingCycle: 'MONTHLY',
        monthlyPrice: 6000,
        setupFeePaid: true,
        nextBillingDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
      },
    })
    orgId = org.id
  })

  it.skipIf(SKIP)('chargeSubscriptionRenewal returns PENDING via MANUAL provider', async () => {
    const result = await chargeSubscriptionRenewal(orgId)
    expect(result.status).toBe('PENDING')

    // Org stays ACTIVE — only PENDING/FAILED renewals trigger PAST_DUE,
    // which the daily subscription-lifecycle worker handles.
    const org = await prisma.organization.findUniqueOrThrow({ where: { id: orgId } })
    expect(org.status).toBe('ACTIVE')

    const payment = await prisma.platformPayment.findFirst({
      where: { organizationId: orgId, type: 'SUBSCRIPTION' },
    })
    expect(payment).not.toBeNull()
    expect(payment!.status).toBe('PENDING')
  })

  it.skipIf(SKIP)('markPastDue transitions the org and is not yet feature-restricted', async () => {
    await markPastDue(orgId)
    const org = await prisma.organization.findUniqueOrThrow({ where: { id: orgId } })

    expect(org.status).toBe('PAST_DUE')
    expect(org.pastDueAt).not.toBeNull()
    // pastDueAt is "now" -> within the 7-day grace window, AI/exports still allowed.
    expect(isFeatureRestricted(org)).toBe(false)
    expect(isReadOnly(org)).toBe(false)
  })

  it.skipIf(SKIP)('after 8 days PAST_DUE, AI/export features become restricted', async () => {
    await prisma.organization.update({
      where: { id: orgId },
      data: { pastDueAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000) },
    })
    const org = await prisma.organization.findUniqueOrThrow({ where: { id: orgId } })

    expect(isFeatureRestricted(org)).toBe(true)
    expect(isReadOnly(org)).toBe(false) // not yet read-only — still PAST_DUE
  })

  it.skipIf(SKIP)('after 14+ days PAST_DUE, markSuspended makes the org read-only', async () => {
    await prisma.organization.update({
      where: { id: orgId },
      data: { pastDueAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000) },
    })
    await markSuspended(orgId)

    const org = await prisma.organization.findUniqueOrThrow({ where: { id: orgId } })
    expect(org.status).toBe('SUSPENDED')
    expect(org.suspendedAt).not.toBeNull()
    expect(org.gracePeriodEndsAt).not.toBeNull()
    expect(org.gracePeriodEndsAt!.getTime()).toBeGreaterThan(org.suspendedAt!.getTime())

    expect(isReadOnly(org)).toBe(true)
    expect(isFeatureRestricted(org)).toBe(true)
  })
})

describe('Billing E2E: auto-top-up at threshold', () => {
  let orgId: string
  let standardPackId: string

  it.skipIf(SKIP)('creates an ACTIVE org near its monthly token threshold', async () => {
    const standardPack = await prisma.tokenTopUpPack.findFirstOrThrow({
      where: { name: DEFAULT_AUTO_TOPUP_PACK_NAME },
    })
    standardPackId = standardPack.id

    const org = await prisma.organization.create({
      data: {
        slug: 'test-billing-autotopup-e2e',
        name: 'Test Billing Auto-TopUp Org',
        email: 'autotopup@billing-e2e.test',
        status: 'ACTIVE',
        plan: 'PRO',
        billingCycle: 'MONTHLY',
        aiEnabled: true,
        setupFeePaid: true,
        monthlyTokenBudget: 100000,
        monthlyTokensUsed: 89000, // remaining = 11,000 > threshold
        autoTopUpEnabled: true,
        autoTopUpThreshold: 10000,
      },
    })
    orgId = org.id
    await ensureWalletExists(orgId)
  })

  it.skipIf(SKIP)('logTokenUsage crossing the threshold triggers an auto top-up', async () => {
    await logTokenUsage({
      organizationId: orgId,
      feature: 'chat',
      model: 'claude-sonnet-4-6',
      provider: 'anthropic',
      inputTokens: 1000,
      outputTokens: 500, // total 1,500 -> remaining drops to 9,500 <= threshold (10,000)
    })

    const org = await prisma.organization.findUniqueOrThrow({ where: { id: orgId } })
    expect(org.monthlyTokensUsed).toBe(90500)
    expect(org.monthlyTokenBudget - org.monthlyTokensUsed).toBeLessThanOrEqual(
      org.autoTopUpThreshold
    )

    const usageLog = await prisma.tokenUsageLog.findFirst({ where: { organizationId: orgId } })
    expect(usageLog?.totalTokens).toBe(1500)

    const order = await prisma.tokenTopUpOrder.findFirst({
      where: { organizationId: orgId, isAutoTopUp: true },
    })
    expect(order).not.toBeNull()
    expect(order!.packId).toBe(standardPackId)
    expect(order!.status).toBe('PENDING') // MANUAL provider -> Super Admin reconciles

    const payment = await prisma.platformPayment.findFirst({
      where: { organizationId: orgId, type: 'TOPUP', topUpOrderId: order!.id },
    })
    expect(payment).not.toBeNull()
    expect(payment!.status).toBe('PENDING')
  })

  it.skipIf(SKIP)(
    'a second usage log within 24h does not trigger a duplicate auto top-up',
    async () => {
      await logTokenUsage({
        organizationId: orgId,
        feature: 'chat',
        model: 'claude-sonnet-4-6',
        provider: 'anthropic',
        inputTokens: 100,
        outputTokens: 50,
      })

      const orders = await prisma.tokenTopUpOrder.findMany({
        where: { organizationId: orgId, isAutoTopUp: true },
      })
      expect(orders).toHaveLength(1)
    }
  )
})

describe('Billing E2E: plan downgrade pro-ration', () => {
  let orgId: string

  it.skipIf(SKIP)('creates an ACTIVE org on BUSINESS, 20 days into its cycle', async () => {
    const org = await prisma.organization.create({
      data: {
        slug: 'test-billing-downgrade-e2e',
        name: 'Test Billing Downgrade Org',
        email: 'downgrade@billing-e2e.test',
        status: 'ACTIVE',
        plan: 'BUSINESS',
        billingCycle: 'MONTHLY',
        monthlyPrice: 12000,
        aiEnabled: true,
        setupFeePaid: true,
        nextBillingDate: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
      },
    })
    orgId = org.id
  })

  it.skipIf(SKIP)('changePlan downgrades to PRO with a credit (no charge)', async () => {
    const businessPlan = await getBillingPlan('BUSINESS')
    const proPlan = await getBillingPlan('PRO')
    const org = await prisma.organization.findUniqueOrThrow({ where: { id: orgId } })

    const expected = calculateProration({
      oldMonthlyEquivalent: planMonthlyEquivalent(businessPlan, 'MONTHLY'),
      newMonthlyEquivalent: planMonthlyEquivalent(proPlan, 'MONTHLY'),
      billingCycle: 'MONTHLY',
      nextBillingDate: org.nextBillingDate!,
    })

    const result = await changePlan(orgId, { newTier: 'PRO' })

    expect(result.proration).not.toBeNull()
    // Downgrading mid-cycle credits the unused portion of the more expensive plan.
    expect(result.proration!.netAmount).toBeLessThan(0)
    expect(result.proration!.netAmount).toBeCloseTo(expected.netAmount, 2)
    expect(result.proration!.cycleDays).toBe(30)

    const updated = await prisma.organization.findUniqueOrThrow({ where: { id: orgId } })
    expect(updated.plan).toBe('PRO')
    expect(updated.monthlyTokenBudget).toBe(proPlan.aiTokensIncluded)
    expect(Number(updated.monthlyPrice)).toBe(Number(proPlan.monthlyPrice))

    // Negative proration -> recorded as a credit, never charged via the
    // payment provider (status defaults to SUCCEEDED, no providerRef).
    const adjustment = await prisma.platformPayment.findFirst({
      where: { organizationId: orgId, type: 'MANUAL_ADJUSTMENT' },
    })
    expect(adjustment).not.toBeNull()
    expect(adjustment!.status).toBe('SUCCEEDED')
    expect(adjustment!.providerRef).toBeNull()
    expect(Number(adjustment!.amount)).toBeCloseTo(result.proration!.netAmount, 2)
  })
})
