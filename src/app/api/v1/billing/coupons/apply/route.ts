import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withTenantApi, apiOk, apiError } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'
import { findValidCoupon, applyDiscount, CouponError } from '@/lib/billing/coupons'
import { getBillingPlan, planPriceForCycle } from '@/lib/billing/plans'

const applyCouponSchema = z.object({
  code: z.string().min(1),
  tier: z.enum(['STARTER', 'PRO', 'BUSINESS', 'ENTERPRISE']).optional(),
  billingCycle: z.enum(['MONTHLY', 'ANNUAL']).optional(),
})

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export async function POST(req: NextRequest) {
  return withTenantApi(
    req,
    'billing:read',
    async ({ ctx }) => {
      try {
        const body = await req.json()
        const data = applyCouponSchema.parse(body)

        const org = await prisma.organization.findUniqueOrThrow({
          where: { id: ctx.organizationId },
          select: { plan: true, billingCycle: true },
        })
        const tier = data.tier ?? org.plan
        const cycle = data.billingCycle ?? org.billingCycle

        const coupon = await findValidCoupon(data.code, ctx.organizationId, tier)
        const plan = await getBillingPlan(tier)
        const subscriptionPrice = planPriceForCycle(plan, cycle)

        const discountAmount = coupon.discountType
          ? round2(
              subscriptionPrice -
                applyDiscount(subscriptionPrice, coupon.discountType, coupon.discountValue)
            )
          : 0

        return apiOk({
          valid: true,
          code: coupon.code,
          description: coupon.description,
          discountType: coupon.discountType,
          discountValue: coupon.discountValue,
          setupFeeWaiver: coupon.setupFeeWaiver,
          bonusTokens: coupon.bonusTokens,
          discountAmount,
        })
      } catch (err) {
        if (err instanceof z.ZodError) return apiError(err.errors[0].message)
        if (err instanceof CouponError) return apiError(err.message)
        throw err
      }
    },
    { bypassSubscriptionCheck: true }
  )
}
