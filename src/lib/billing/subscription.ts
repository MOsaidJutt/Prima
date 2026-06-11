import type {
  BillingCycle,
  PlatformPaymentStatus,
  PromotionAppliesTo,
  SubscriptionPlan,
} from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { createAuditLog } from '@/lib/audit'
import { ensureWalletExists } from '@/lib/ai/wallet'
import { getPaymentProvider } from '@/lib/payments/providers/factory'
import { getDefaultPaymentMethod } from './payment-methods'
import { getBillingPlan, planMonthlyEquivalent, planPriceForCycle } from './plans'
import { calculateProration, type ProrationResult } from './proration'
import {
  applyDiscount,
  findValidCoupon,
  getActivePromotions,
  recordCouponRedemption,
} from './coupons'
import { SUSPENDED_GRACE_PERIOD_DAYS } from './constants'
import { daysSince, isFeatureRestricted, isReadOnly } from './status'

export { daysSince, isFeatureRestricted, isReadOnly }

export class SubscriptionError extends Error {}

function addPeriod(date: Date, cycle: BillingCycle): Date {
  const d = new Date(date)
  if (cycle === 'ANNUAL') d.setFullYear(d.getFullYear() + 1)
  else d.setMonth(d.getMonth() + 1)
  return d
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

interface CheckoutCharges {
  subscriptionPrice: number
  setupFee: number
  discount: number
  total: number
  promoBonusTokens: number
  couponId: string | null
  couponBonusTokens: number
  couponSetupFeeWaived: boolean
}

async function computeCheckoutCharges(params: {
  organizationId: string
  tier: SubscriptionPlan
  billingCycle: BillingCycle
  setupFeeAlreadyPaid: boolean
  couponCode?: string
}): Promise<CheckoutCharges> {
  const plan = await getBillingPlan(params.tier)
  const subscriptionPrice = planPriceForCycle(plan, params.billingCycle)
  let setupFee = params.setupFeeAlreadyPaid ? 0 : Number(plan.setupFee)
  let promoBonusTokens = 0
  let discount = 0

  const promoType: PromotionAppliesTo = params.billingCycle === 'ANNUAL' ? 'ANNUAL' : 'NEW_SIGNUPS'
  const promos = await getActivePromotions(promoType)
  for (const promo of promos) {
    if (promo.setupFeeWaiver) setupFee = 0
    if (promo.bonusTokens) promoBonusTokens += promo.bonusTokens
    if (promo.discountType) {
      const base = subscriptionPrice + setupFee
      discount += round2(base - applyDiscount(base, promo.discountType, promo.discountValue))
    }
  }

  let couponId: string | null = null
  let couponBonusTokens = 0
  let couponSetupFeeWaived = false
  if (params.couponCode) {
    const coupon = await findValidCoupon(params.couponCode, params.organizationId, params.tier)
    if (coupon.setupFeeWaiver && setupFee > 0) {
      setupFee = 0
      couponSetupFeeWaived = true
    }
    if (coupon.bonusTokens) couponBonusTokens = coupon.bonusTokens
    if (coupon.discountType) {
      const base = subscriptionPrice + setupFee
      discount += round2(base - applyDiscount(base, coupon.discountType, coupon.discountValue))
    }
    couponId = coupon.id
  }

  const total = Math.max(0, round2(subscriptionPrice + setupFee - discount))

  return {
    subscriptionPrice,
    setupFee,
    discount,
    total,
    promoBonusTokens,
    couponId,
    couponBonusTokens,
    couponSetupFeeWaived,
  }
}

/** Split a combined discount proportionally across subscription fee and setup fee. */
function splitAmounts(subscriptionPrice: number, setupFee: number, discount: number) {
  const base = subscriptionPrice + setupFee
  if (base <= 0) return { subscriptionAmount: 0, setupAmount: 0 }
  const subShare = subscriptionPrice / base
  const subDiscount = round2(discount * subShare)
  const setupDiscount = round2(discount - subDiscount)
  return {
    subscriptionAmount: Math.max(0, round2(subscriptionPrice - subDiscount)),
    setupAmount: Math.max(0, round2(setupFee - setupDiscount)),
  }
}

/**
 * Converts a TRIAL organization to a paid subscription: charges the first
 * billing period (+ setup fee unless already paid/waived), applies any
 * active promotions and an optional coupon code, and activates the org.
 */
export async function convertTrialToPaid(
  organizationId: string,
  params: { tier: SubscriptionPlan; billingCycle: BillingCycle; couponCode?: string },
  userId?: string | null
) {
  const org = await prisma.organization.findUniqueOrThrow({ where: { id: organizationId } })
  const plan = await getBillingPlan(params.tier)

  const charges = await computeCheckoutCharges({
    organizationId,
    tier: params.tier,
    billingCycle: params.billingCycle,
    setupFeeAlreadyPaid: org.setupFeePaid,
    couponCode: params.couponCode,
  })

  const defaultMethod = await getDefaultPaymentMethod(organizationId)
  const providerType = defaultMethod?.provider ?? 'MANUAL'

  let paymentStatus: PlatformPaymentStatus = 'SUCCEEDED'
  let providerRef: string | undefined

  if (charges.total > 0) {
    const provider = getPaymentProvider(providerType)
    const result = await provider.charge({
      amountPkr: charges.total,
      description: `${plan.name} plan${params.billingCycle === 'ANNUAL' ? ' (annual)' : ''}${charges.setupFee > 0 ? ' + setup fee' : ''}`,
      customerId: defaultMethod?.providerCustomerId,
      paymentMethodId: defaultMethod?.providerPaymentMethodId,
      metadata: { organizationId, type: 'SUBSCRIPTION_CONVERSION' },
    })
    if (result.status === 'FAILED') {
      throw new SubscriptionError(
        result.error ?? 'Payment failed. Please check your payment method.'
      )
    }
    paymentStatus = result.status
    providerRef = result.providerRef
  }

  const now = new Date()
  const nextBillingDate = addPeriod(now, params.billingCycle)
  const { subscriptionAmount, setupAmount } = splitAmounts(
    charges.subscriptionPrice,
    charges.setupFee,
    charges.discount
  )

  await prisma.$transaction(async (tx) => {
    await tx.organization.update({
      where: { id: organizationId },
      data: {
        status: 'ACTIVE',
        plan: params.tier,
        billingCycle: params.billingCycle,
        monthlyPrice: planMonthlyEquivalent(plan, params.billingCycle),
        subscriptionStart: now,
        nextBillingDate,
        setupFeePaid: true,
        monthlyTokenBudget: plan.aiTokensIncluded,
        aiEnabled: plan.aiEnabled,
        trialEndsAt: org.trialEndsAt ?? now,
        pastDueAt: null,
        suspendedAt: null,
        cancelledAt: null,
        gracePeriodEndsAt: null,
      },
    })

    await tx.platformPayment.create({
      data: {
        organizationId,
        type: 'SUBSCRIPTION',
        amount: subscriptionAmount,
        provider: providerType,
        providerRef,
        status: paymentStatus,
      },
    })

    if (charges.setupFee > 0 || (org.setupFeePaid === false && setupAmount === 0)) {
      await tx.platformPayment.create({
        data: {
          organizationId,
          type: 'SETUP_FEE',
          amount: setupAmount,
          provider: providerType,
          providerRef,
          status: paymentStatus,
        },
      })
    }

    if (charges.promoBonusTokens > 0) {
      await tx.tokenWallet.upsert({
        where: { organizationId },
        create: {
          organizationId,
          balance: charges.promoBonusTokens,
          totalPurchased: charges.promoBonusTokens,
        },
        update: {
          balance: { increment: charges.promoBonusTokens },
          totalPurchased: { increment: charges.promoBonusTokens },
        },
      })
    }
  })

  if (charges.couponId) {
    if (charges.couponBonusTokens > 0) await ensureWalletExists(organizationId)
    await recordCouponRedemption({
      couponId: charges.couponId,
      organizationId,
      discountApplied: charges.discount,
      bonusTokensGranted: charges.couponBonusTokens,
      setupFeeWaived: charges.couponSetupFeeWaived,
    })
  }

  await createAuditLog({
    organizationId,
    userId,
    action: 'UPDATE',
    entity: 'Billing',
    entityId: organizationId,
    oldValue: { status: org.status, plan: org.plan },
    newValue: {
      event: 'trial_converted',
      plan: params.tier,
      billingCycle: params.billingCycle,
      total: charges.total,
    },
  })

  return charges
}

/**
 * Changes an active subscription's plan (and optionally billing cycle),
 * pro-rating the difference for the remainder of the current cycle.
 * TRIAL orgs simply switch which plan they're trialing — no charge.
 */
export async function changePlan(
  organizationId: string,
  params: { newTier: SubscriptionPlan; billingCycle?: BillingCycle },
  userId?: string | null
): Promise<{ proration: ProrationResult | null }> {
  const org = await prisma.organization.findUniqueOrThrow({ where: { id: organizationId } })
  const newPlan = await getBillingPlan(params.newTier)

  if (org.status === 'TRIAL') {
    await prisma.organization.update({
      where: { id: organizationId },
      data: {
        plan: params.newTier,
        billingCycle: params.billingCycle ?? org.billingCycle,
        monthlyTokenBudget: newPlan.aiTokensIncluded,
        aiEnabled: newPlan.aiEnabled,
      },
    })
    await createAuditLog({
      organizationId,
      userId,
      action: 'UPDATE',
      entity: 'Billing',
      entityId: organizationId,
      oldValue: { plan: org.plan },
      newValue: { event: 'trial_plan_selected', plan: params.newTier },
    })
    return { proration: null }
  }

  if (org.status !== 'ACTIVE' && org.status !== 'PAST_DUE') {
    throw new SubscriptionError('Plan changes are only available for active subscriptions.')
  }
  if (!org.nextBillingDate) {
    throw new SubscriptionError('No active billing cycle found for this organization.')
  }

  const newCycle = params.billingCycle ?? org.billingCycle
  const oldPlan = await getBillingPlan(org.plan)

  const oldMonthly = planMonthlyEquivalent(oldPlan, org.billingCycle)
  const newMonthly = planMonthlyEquivalent(newPlan, newCycle)

  const proration = calculateProration({
    oldMonthlyEquivalent: oldMonthly,
    newMonthlyEquivalent: newMonthly,
    billingCycle: org.billingCycle,
    nextBillingDate: org.nextBillingDate,
  })

  const defaultMethod = await getDefaultPaymentMethod(organizationId)
  const providerType = defaultMethod?.provider ?? 'MANUAL'

  let paymentStatus: PlatformPaymentStatus = 'SUCCEEDED'
  let providerRef: string | undefined

  if (proration.netAmount > 0) {
    const provider = getPaymentProvider(providerType)
    const result = await provider.charge({
      amountPkr: proration.netAmount,
      description: `Plan change proration: ${org.plan} -> ${params.newTier}`,
      customerId: defaultMethod?.providerCustomerId,
      paymentMethodId: defaultMethod?.providerPaymentMethodId,
      metadata: { organizationId, type: 'PLAN_CHANGE_PRORATION' },
    })
    if (result.status === 'FAILED') {
      throw new SubscriptionError(
        result.error ?? 'Could not charge the proration amount for this upgrade.'
      )
    }
    paymentStatus = result.status
    providerRef = result.providerRef
  }

  await prisma.$transaction([
    prisma.organization.update({
      where: { id: organizationId },
      data: {
        plan: params.newTier,
        billingCycle: newCycle,
        monthlyPrice: newMonthly,
        monthlyTokenBudget: newPlan.aiTokensIncluded,
        aiEnabled: newPlan.aiEnabled,
      },
    }),
    prisma.platformPayment.create({
      data: {
        organizationId,
        type: 'MANUAL_ADJUSTMENT',
        amount: proration.netAmount,
        provider: providerType,
        providerRef,
        status: paymentStatus,
        notes: `Proration for plan change ${org.plan} -> ${params.newTier} (${proration.daysRemaining}/${proration.cycleDays} days remaining in cycle)`,
      },
    }),
  ])

  await createAuditLog({
    organizationId,
    userId,
    action: 'UPDATE',
    entity: 'Billing',
    entityId: organizationId,
    oldValue: { plan: org.plan, billingCycle: org.billingCycle },
    newValue: { plan: params.newTier, billingCycle: newCycle, proration: proration.netAmount },
  })

  return { proration }
}

/**
 * Charges the subscription renewal fee for an ACTIVE/PAST_DUE org whose
 * `nextBillingDate` has passed. On success the org is (re)activated and
 * `nextBillingDate` advances by one billing period. On failure the caller
 * is responsible for transitioning the org to PAST_DUE.
 */
export async function chargeSubscriptionRenewal(
  organizationId: string
): Promise<{ status: PlatformPaymentStatus; error?: string }> {
  const org = await prisma.organization.findUniqueOrThrow({ where: { id: organizationId } })
  if (org.status !== 'ACTIVE' && org.status !== 'PAST_DUE') {
    return { status: 'FAILED', error: 'Organization is not in a billable state.' }
  }

  const amount =
    org.billingCycle === 'ANNUAL' ? round2(Number(org.monthlyPrice) * 12) : Number(org.monthlyPrice)

  const defaultMethod = await getDefaultPaymentMethod(organizationId)
  const providerType = defaultMethod?.provider ?? 'MANUAL'
  const provider = getPaymentProvider(providerType)

  const result = await provider.charge({
    amountPkr: amount,
    description: `Subscription renewal — ${org.plan} (${org.billingCycle.toLowerCase()})`,
    customerId: defaultMethod?.providerCustomerId,
    paymentMethodId: defaultMethod?.providerPaymentMethodId,
    metadata: { organizationId, type: 'SUBSCRIPTION_RENEWAL' },
  })

  await prisma.platformPayment.create({
    data: {
      organizationId,
      type: 'SUBSCRIPTION',
      amount,
      provider: providerType,
      providerRef: result.providerRef,
      status: result.status,
      notes: result.error,
    },
  })

  if (result.status === 'SUCCEEDED') {
    await prisma.organization.update({
      where: { id: organizationId },
      data: {
        status: 'ACTIVE',
        pastDueAt: null,
        nextBillingDate: addPeriod(org.nextBillingDate ?? new Date(), org.billingCycle),
      },
    })
  }

  return { status: result.status, error: result.error }
}

export async function markPastDue(organizationId: string): Promise<void> {
  await prisma.organization.update({
    where: { id: organizationId },
    data: { status: 'PAST_DUE', pastDueAt: new Date() },
  })
}

export async function markSuspended(organizationId: string): Promise<void> {
  const now = new Date()
  await prisma.organization.update({
    where: { id: organizationId },
    data: {
      status: 'SUSPENDED',
      suspendedAt: now,
      gracePeriodEndsAt: new Date(
        now.getTime() + SUSPENDED_GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000
      ),
    },
  })
}

export async function cancelSubscription(organizationId: string): Promise<void> {
  await prisma.organization.update({
    where: { id: organizationId },
    data: { status: 'CANCELLED', cancelledAt: new Date() },
  })
}

/**
 * Super Admin reconciliation of a manually-recorded (or otherwise pending)
 * platform payment. On marking a SUBSCRIPTION/SETUP_FEE/TOPUP payment as
 * SUCCEEDED, applies the corresponding side effects (renewal date, setup fee
 * flag, wallet top-up).
 */
export async function reconcilePlatformPayment(
  paymentId: string,
  status: Extract<PlatformPaymentStatus, 'SUCCEEDED' | 'FAILED' | 'REFUNDED'>,
  notes?: string
) {
  const payment = await prisma.platformPayment.findUniqueOrThrow({ where: { id: paymentId } })

  await prisma.platformPayment.update({
    where: { id: paymentId },
    data: { status, notes: notes ?? payment.notes },
  })

  if (status !== 'SUCCEEDED') return payment

  const org = await prisma.organization.findUniqueOrThrow({ where: { id: payment.organizationId } })

  if (payment.type === 'SUBSCRIPTION') {
    await prisma.organization.update({
      where: { id: payment.organizationId },
      data: {
        status: 'ACTIVE',
        pastDueAt: null,
        suspendedAt: null,
        gracePeriodEndsAt: null,
        nextBillingDate: addPeriod(org.nextBillingDate ?? new Date(), org.billingCycle),
      },
    })
  } else if (payment.type === 'SETUP_FEE') {
    await prisma.organization.update({
      where: { id: payment.organizationId },
      data: { setupFeePaid: true },
    })
  } else if (payment.type === 'TOPUP' && payment.topUpOrderId) {
    const order = await prisma.tokenTopUpOrder.findUnique({ where: { id: payment.topUpOrderId } })
    if (order && order.status !== 'COMPLETED') {
      await prisma.$transaction([
        prisma.tokenTopUpOrder.update({
          where: { id: order.id },
          data: { status: 'COMPLETED', completedAt: new Date() },
        }),
        prisma.tokenWallet.upsert({
          where: { organizationId: payment.organizationId },
          create: {
            organizationId: payment.organizationId,
            balance: order.tokens,
            totalPurchased: order.tokens,
          },
          update: {
            balance: { increment: order.tokens },
            totalPurchased: { increment: order.tokens },
          },
        }),
      ])
    }
  }

  return payment
}
