import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withTenantApi, apiOk, apiError } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'
import { convertTrialToPaid, SubscriptionError } from '@/lib/billing/subscription'
import { CouponError } from '@/lib/billing/coupons'

const subscribeSchema = z.object({
  tier: z.enum(['STARTER', 'PRO', 'BUSINESS', 'ENTERPRISE']),
  billingCycle: z.enum(['MONTHLY', 'ANNUAL']),
  couponCode: z.string().optional(),
})

export async function POST(req: NextRequest) {
  return withTenantApi(
    req,
    'billing:update',
    async ({ ctx }) => {
      const org = await prisma.organization.findUniqueOrThrow({
        where: { id: ctx.organizationId },
        select: { status: true },
      })
      if (org.status !== 'TRIAL') {
        return apiError('This organization has already activated a subscription.', 400)
      }

      try {
        const body = await req.json()
        const data = subscribeSchema.parse(body)
        const charges = await convertTrialToPaid(ctx.organizationId, data, ctx.userId)
        return apiOk({ charges })
      } catch (err) {
        if (err instanceof z.ZodError) return apiError(err.errors[0].message)
        if (err instanceof SubscriptionError || err instanceof CouponError)
          return apiError(err.message)
        throw err
      }
    },
    { bypassSubscriptionCheck: true }
  )
}
