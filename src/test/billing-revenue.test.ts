// @vitest-environment node
/**
 * Unit tests for src/lib/billing/revenue.ts — verifies the MRR/ARR math,
 * plan breakdown, churn, trial conversion, LTV, and cohort retention against
 * a fixed in-memory set of organizations. Prisma is mocked.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { subMonths, startOfMonth, format } from 'date-fns'

const mockOrgFindMany = vi.fn()
const mockPaymentFindMany = vi.fn()

vi.mock('@/lib/prisma', () => ({
  prisma: {
    organization: {
      findMany: (...args: unknown[]) => mockOrgFindMany(...args),
    },
    platformPayment: {
      findMany: (...args: unknown[]) => mockPaymentFindMany(...args),
    },
  },
}))

import { getRevenueStats } from '@/lib/billing/revenue'

const DAY_MS = 24 * 60 * 60 * 1000
const now = new Date()
// Anchored mid-month two months back so every fixture org is unambiguously
// inside one cohort month and well past the 30-day churn window.
const twoMonthsAgo = new Date(startOfMonth(subMonths(now, 2)).getTime() + 10 * DAY_MS)

function org(overrides: Record<string, unknown>) {
  return {
    id: `org-${Math.random()}`,
    plan: 'PRO',
    status: 'ACTIVE',
    monthlyPrice: 6000,
    createdAt: twoMonthsAgo,
    trialEndsAt: null,
    subscriptionStart: null,
    cancelledAt: null,
    ...overrides,
  }
}

const FIXTURE_ORGS = [
  // Two ACTIVE PRO orgs, one of which converted from a trial.
  org({ id: 'a1' }),
  org({
    id: 'a2',
    trialEndsAt: new Date(now.getTime() - 40 * DAY_MS),
    subscriptionStart: new Date(now.getTime() - 35 * DAY_MS),
  }),
  // PAST_DUE still counts toward MRR.
  org({ id: 'p1', plan: 'STARTER', status: 'PAST_DUE', monthlyPrice: 3000 }),
  // TRIAL org created this month — not billable, still in trial.
  org({
    id: 't1',
    status: 'TRIAL',
    monthlyPrice: 0,
    createdAt: now,
    trialEndsAt: new Date(now.getTime() + 7 * DAY_MS),
  }),
  // Cancelled 10 days ago — counts as churn within the 30-day window.
  org({
    id: 'c1',
    status: 'CANCELLED',
    monthlyPrice: 0,
    cancelledAt: new Date(now.getTime() - 10 * DAY_MS),
  }),
  // Suspended — not billable but still in the churn base.
  org({ id: 's1', status: 'SUSPENDED', monthlyPrice: 0 }),
]

beforeEach(() => {
  mockOrgFindMany.mockReset()
  mockPaymentFindMany.mockReset()
  mockOrgFindMany.mockResolvedValue(FIXTURE_ORGS)
  mockPaymentFindMany.mockResolvedValue([
    { amount: 5000, createdAt: now },
    { amount: 2500, createdAt: now },
  ])
})

describe('getRevenueStats', () => {
  it('computes MRR/ARR from ACTIVE + PAST_DUE orgs only', async () => {
    const stats = await getRevenueStats()
    expect(stats.mrr).toBe(15000) // 6000 + 6000 + 3000
    expect(stats.arr).toBe(180000)
    expect(stats.activeSubscriptions).toBe(3)
  })

  it('counts orgs by status', async () => {
    const stats = await getRevenueStats()
    expect(stats.trialOrgs).toBe(1)
    expect(stats.pastDueOrgs).toBe(1)
    expect(stats.suspendedOrgs).toBe(1)
    expect(stats.cancelledOrgs).toBe(1)
  })

  it('breaks MRR down per plan', async () => {
    const stats = await getRevenueStats()
    const pro = stats.planBreakdown.find((p) => p.plan === 'PRO')
    const starter = stats.planBreakdown.find((p) => p.plan === 'STARTER')
    expect(pro).toEqual({ plan: 'PRO', count: 2, mrr: 12000 })
    expect(starter).toEqual({ plan: 'STARTER', count: 1, mrr: 3000 })
  })

  it('buckets realized subscription payments into the current trend month', async () => {
    const stats = await getRevenueStats()
    expect(stats.mrrTrend).toHaveLength(12)
    expect(stats.mrrTrend[11].month).toBe(format(now, 'MMM yy'))
    expect(stats.mrrTrend[11].mrr).toBe(7500)
    expect(stats.mrrTrend[0].mrr).toBe(0)
  })

  it('computes 30-day churn against the pre-existing org base', async () => {
    const stats = await getRevenueStats()
    // Base = 5 orgs older than 30 days (trial org is too new); 1 cancelled.
    expect(stats.churn.cancelledLast30d).toBe(1)
    expect(stats.churn.baseOrgs).toBe(5)
    expect(stats.churn.rate).toBe(0.2)
  })

  it('computes the trial conversion funnel', async () => {
    const stats = await getRevenueStats()
    expect(stats.trialConversion.totalTrials).toBe(2)
    expect(stats.trialConversion.converted).toBe(1)
    expect(stats.trialConversion.stillInTrial).toBe(1)
    expect(stats.trialConversion.rate).toBe(0.5)
  })

  it('estimates LTV as ARPU / churn rate', async () => {
    const stats = await getRevenueStats()
    // ARPU = 15000 / 3 = 5000; LTV = 5000 / 0.2 = 25000
    expect(stats.ltvEstimate).toBe(25000)
  })

  it('returns null LTV when there is no churn', async () => {
    mockOrgFindMany.mockResolvedValue(FIXTURE_ORGS.filter((o) => o.status !== 'CANCELLED'))
    const stats = await getRevenueStats()
    expect(stats.churn.rate).toBe(0)
    expect(stats.ltvEstimate).toBeNull()
  })

  it('snapshots cohort retention per signup month', async () => {
    const stats = await getRevenueStats()
    expect(stats.cohortRetention).toHaveLength(6)

    const oldCohort = stats.cohortRetention.find((c) => c.cohort === format(twoMonthsAgo, 'MMM yy'))
    // 5 orgs signed up two months ago; the cancelled one is not retained.
    expect(oldCohort).toEqual({
      cohort: format(twoMonthsAgo, 'MMM yy'),
      size: 5,
      retained: 4,
      retentionRate: 0.8,
    })

    const currentCohort = stats.cohortRetention[5]
    expect(currentCohort.size).toBe(1)
    expect(currentCohort.retained).toBe(1)
  })

  it('only queries non-deleted organizations', async () => {
    await getRevenueStats()
    expect(mockOrgFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { deletedAt: null } })
    )
  })
})
