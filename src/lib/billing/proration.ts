import type { BillingCycle } from '@prisma/client'

export interface ProrationResult {
  /** Days remaining in the current billing cycle (including today). */
  daysRemaining: number
  /** Total days in the current billing cycle. */
  cycleDays: number
  /** Credit for unused time on the old plan (PKR). */
  unusedCredit: number
  /** Charge for the new plan for the remainder of the cycle (PKR). */
  newPlanCharge: number
  /**
   * Net amount due now (PKR). Positive = charge the tenant immediately
   * (upgrade). Negative = credit applied to the next invoice (downgrade).
   */
  netAmount: number
}

function cycleDaysFor(cycle: BillingCycle): number {
  return cycle === 'ANNUAL' ? 365 : 30
}

/**
 * Pro-rates a mid-cycle plan change. `oldMonthlyEquivalent` and
 * `newMonthlyEquivalent` are the monthly-equivalent prices (annual price / 12
 * for annual plans) in PKR. `nextBillingDate` is the org's current renewal
 * date — used to compute days remaining in the cycle.
 */
export function calculateProration(params: {
  oldMonthlyEquivalent: number
  newMonthlyEquivalent: number
  billingCycle: BillingCycle
  nextBillingDate: Date
  now?: Date
}): ProrationResult {
  const now = params.now ?? new Date()
  const cycleDays = cycleDaysFor(params.billingCycle)

  const msRemaining = params.nextBillingDate.getTime() - now.getTime()
  const daysRemainingRaw = Math.ceil(msRemaining / (1000 * 60 * 60 * 24))
  const daysRemaining = Math.min(cycleDays, Math.max(0, daysRemainingRaw))

  // Convert monthly-equivalent price to a daily rate for the cycle.
  const dailyRate = (priceMonthly: number) => (priceMonthly * 12) / 365

  const unusedCredit = round2(dailyRate(params.oldMonthlyEquivalent) * daysRemaining)
  const newPlanCharge = round2(dailyRate(params.newMonthlyEquivalent) * daysRemaining)
  const netAmount = round2(newPlanCharge - unusedCredit)

  return { daysRemaining, cycleDays, unusedCredit, newPlanCharge, netAmount }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
