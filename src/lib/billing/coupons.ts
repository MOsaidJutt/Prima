import type { Coupon, CouponDiscountType, Promotion, SubscriptionPlan } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export class CouponError extends Error {}

/** Look up a coupon by code and validate it can be applied to the given plan/org. */
export async function findValidCoupon(
  code: string,
  organizationId: string,
  planTier: SubscriptionPlan
): Promise<Coupon> {
  const coupon = await prisma.coupon.findUnique({ where: { code: code.trim().toUpperCase() } })
  if (!coupon || !coupon.isActive) throw new CouponError('Invalid or inactive coupon code.')

  const now = new Date()
  if (coupon.validFrom > now) throw new CouponError('This coupon is not yet active.')
  if (coupon.validUntil && coupon.validUntil < now)
    throw new CouponError('This coupon has expired.')
  if (coupon.maxRedemptions !== null && coupon.redemptionCount >= coupon.maxRedemptions) {
    throw new CouponError('This coupon has reached its redemption limit.')
  }
  if (coupon.applicablePlans.length > 0 && !coupon.applicablePlans.includes(planTier)) {
    throw new CouponError('This coupon does not apply to the selected plan.')
  }

  const existing = await prisma.couponRedemption.findUnique({
    where: { couponId_organizationId: { couponId: coupon.id, organizationId } },
  })
  if (existing) throw new CouponError('This coupon has already been redeemed by your organization.')

  return coupon
}

/** Active platform-wide promotions that apply automatically (no code needed). */
export async function getActivePromotions(
  appliesTo?: Promotion['appliesTo']
): Promise<Promotion[]> {
  const now = new Date()
  return prisma.promotion.findMany({
    where: {
      isActive: true,
      OR: [{ startsAt: null }, { startsAt: { lte: now } }],
      AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: now } }] }],
      ...(appliesTo ? { appliesTo: { in: ['ALL', appliesTo] } } : {}),
    },
  })
}

export function applyDiscount(
  amount: number,
  discountType: CouponDiscountType | null,
  discountValue: unknown | null
): number {
  if (!discountType || discountValue === null || discountValue === undefined) return amount
  const value = Number(discountValue)
  if (discountType === 'PERCENT') return round2(amount * (1 - value / 100))
  return round2(Math.max(0, amount - value))
}

export async function recordCouponRedemption(params: {
  couponId: string
  organizationId: string
  discountApplied: number
  bonusTokensGranted: number
  setupFeeWaived: boolean
}) {
  await prisma.$transaction([
    prisma.couponRedemption.create({
      data: {
        couponId: params.couponId,
        organizationId: params.organizationId,
        discountApplied: params.discountApplied,
        bonusTokensGranted: params.bonusTokensGranted,
        setupFeeWaived: params.setupFeeWaived,
      },
    }),
    prisma.coupon.update({
      where: { id: params.couponId },
      data: { redemptionCount: { increment: 1 } },
    }),
    ...(params.bonusTokensGranted > 0
      ? [
          prisma.tokenWallet.update({
            where: { organizationId: params.organizationId },
            data: {
              balance: { increment: params.bonusTokensGranted },
              totalPurchased: { increment: params.bonusTokensGranted },
            },
          }),
        ]
      : []),
  ])
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
