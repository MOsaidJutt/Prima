import type { BillingCycle, SubscriptionPlan } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export const PLAN_TIER_ORDER: SubscriptionPlan[] = ['STARTER', 'PRO', 'BUSINESS', 'ENTERPRISE']

export function planRank(tier: SubscriptionPlan): number {
  return PLAN_TIER_ORDER.indexOf(tier)
}

export async function getActivePlans() {
  return prisma.billingPlan.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
  })
}

export async function getBillingPlan(tier: SubscriptionPlan) {
  const plan = await prisma.billingPlan.findUnique({ where: { tier } })
  if (!plan) throw new Error(`Billing plan not configured for tier ${tier}`)
  return plan
}

/** The price for one billing period (month or year) in PKR, as a number. */
export function planPriceForCycle(
  plan: { monthlyPrice: unknown; annualPrice: unknown },
  cycle: BillingCycle
): number {
  return cycle === 'ANNUAL' ? Number(plan.annualPrice) : Number(plan.monthlyPrice)
}

/** Effective monthly price (annual price / 12) — used for proration math. */
export function planMonthlyEquivalent(
  plan: { monthlyPrice: unknown; annualPrice: unknown },
  cycle: BillingCycle
): number {
  return cycle === 'ANNUAL' ? Number(plan.annualPrice) / 12 : Number(plan.monthlyPrice)
}

export function isUpgrade(from: SubscriptionPlan, to: SubscriptionPlan): boolean {
  return planRank(to) > planRank(from)
}

export function isDowngrade(from: SubscriptionPlan, to: SubscriptionPlan): boolean {
  return planRank(to) < planRank(from)
}
