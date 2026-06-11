import type { OrgStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { subMonths, startOfMonth, endOfMonth, format } from 'date-fns'

const MRR_STATUSES: OrgStatus[] = ['ACTIVE', 'PAST_DUE']
const DAY_MS = 24 * 60 * 60 * 1000

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000
}

export interface RevenueStats {
  mrr: number
  arr: number
  activeSubscriptions: number
  trialOrgs: number
  pastDueOrgs: number
  suspendedOrgs: number
  cancelledOrgs: number
  planBreakdown: Array<{ plan: string; count: number; mrr: number }>
  /** Realized subscription revenue per month (last 12 months), from successful PlatformPayments. */
  mrrTrend: Array<{ month: string; mrr: number }>
  churn: { rate: number; cancelledLast30d: number; baseOrgs: number }
  trialConversion: { totalTrials: number; converted: number; stillInTrial: number; rate: number }
  /** ARPU / monthly churn rate. Null when churn rate is 0 (insufficient data). */
  ltvEstimate: number | null
  /**
   * Retention per signup-month cohort, last 6 months. This is a *current
   * snapshot* (% of each cohort not yet CANCELLED), not a true month-by-month
   * retention curve — reconstructing the latter would require a historical
   * status-change log that doesn't exist yet.
   */
  cohortRetention: Array<{ cohort: string; size: number; retained: number; retentionRate: number }>
}

export async function getRevenueStats(): Promise<RevenueStats> {
  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * DAY_MS)

  const orgs = await prisma.organization.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      plan: true,
      status: true,
      monthlyPrice: true,
      createdAt: true,
      trialEndsAt: true,
      subscriptionStart: true,
      cancelledAt: true,
    },
  })

  const billable = orgs.filter((o) => MRR_STATUSES.includes(o.status))
  const mrr = round2(billable.reduce((sum, o) => sum + Number(o.monthlyPrice), 0))
  const arr = round2(mrr * 12)

  const planBreakdownMap = new Map<string, { count: number; mrr: number }>()
  for (const o of billable) {
    const entry = planBreakdownMap.get(o.plan) ?? { count: 0, mrr: 0 }
    entry.count += 1
    entry.mrr += Number(o.monthlyPrice)
    planBreakdownMap.set(o.plan, entry)
  }
  const planBreakdown = Array.from(planBreakdownMap.entries()).map(([plan, v]) => ({
    plan,
    count: v.count,
    mrr: round2(v.mrr),
  }))

  // MRR trend — last 12 months, from successful subscription/renewal payments.
  const twelveMonthsAgo = startOfMonth(subMonths(now, 11))
  const subPayments = await prisma.platformPayment.findMany({
    where: { type: 'SUBSCRIPTION', status: 'SUCCEEDED', createdAt: { gte: twelveMonthsAgo } },
    select: { amount: true, createdAt: true },
  })
  const mrrTrend = Array.from({ length: 12 }).map((_, i) => {
    const d = subMonths(now, 11 - i)
    const start = startOfMonth(d)
    const end = endOfMonth(d)
    const total = subPayments
      .filter((p) => p.createdAt >= start && p.createdAt <= end)
      .reduce((sum, p) => sum + Number(p.amount), 0)
    return { month: format(d, 'MMM yy'), mrr: round2(total) }
  })

  // Churn (last 30 days) = orgs cancelled / orgs that existed and weren't
  // already cancelled 30 days ago.
  const cancelledLast30d = orgs.filter(
    (o) => o.cancelledAt && o.cancelledAt >= thirtyDaysAgo
  ).length
  const baseOrgs = orgs.filter(
    (o) => o.createdAt < thirtyDaysAgo && (!o.cancelledAt || o.cancelledAt >= thirtyDaysAgo)
  ).length
  const churnRate = baseOrgs > 0 ? round4(cancelledLast30d / baseOrgs) : 0

  // Trial -> paid conversion funnel (all-time).
  const everTrialed = orgs.filter((o) => o.trialEndsAt !== null)
  const converted = everTrialed.filter((o) => o.subscriptionStart !== null)
  const stillInTrial = everTrialed.filter((o) => o.status === 'TRIAL')
  const trialConversion = {
    totalTrials: everTrialed.length,
    converted: converted.length,
    stillInTrial: stillInTrial.length,
    rate: everTrialed.length > 0 ? round4(converted.length / everTrialed.length) : 0,
  }

  // LTV estimate: average revenue per billable org / monthly churn rate.
  const arpu = billable.length > 0 ? mrr / billable.length : 0
  const ltvEstimate = churnRate > 0 ? round2(arpu / churnRate) : null

  // Cohort retention — last 6 signup-month cohorts.
  const cohortRetention = Array.from({ length: 6 }).map((_, i) => {
    const d = subMonths(now, 5 - i)
    const start = startOfMonth(d)
    const end = endOfMonth(d)
    const cohortOrgs = orgs.filter((o) => o.createdAt >= start && o.createdAt <= end)
    const retained = cohortOrgs.filter((o) => o.status !== 'CANCELLED')
    return {
      cohort: format(d, 'MMM yy'),
      size: cohortOrgs.length,
      retained: retained.length,
      retentionRate: cohortOrgs.length > 0 ? round4(retained.length / cohortOrgs.length) : 0,
    }
  })

  return {
    mrr,
    arr,
    activeSubscriptions: billable.length,
    trialOrgs: orgs.filter((o) => o.status === 'TRIAL').length,
    pastDueOrgs: orgs.filter((o) => o.status === 'PAST_DUE').length,
    suspendedOrgs: orgs.filter((o) => o.status === 'SUSPENDED').length,
    cancelledOrgs: orgs.filter((o) => o.status === 'CANCELLED').length,
    planBreakdown,
    mrrTrend,
    churn: { rate: churnRate, cancelledLast30d, baseOrgs },
    trialConversion,
    ltvEstimate,
    cohortRetention,
  }
}
