import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withTenantApi, apiOk, apiError } from '@/lib/api-helpers'
import { changePlan, SubscriptionError } from '@/lib/billing/subscription'

const changePlanSchema = z.object({
  newTier: z.enum(['STARTER', 'PRO', 'BUSINESS', 'ENTERPRISE']),
  billingCycle: z.enum(['MONTHLY', 'ANNUAL']).optional(),
})

export async function POST(req: NextRequest) {
  return withTenantApi(
    req,
    'billing:update',
    async ({ ctx }) => {
      try {
        const body = await req.json()
        const data = changePlanSchema.parse(body)
        const result = await changePlan(ctx.organizationId, data, ctx.userId)
        return apiOk(result)
      } catch (err) {
        if (err instanceof z.ZodError) return apiError(err.errors[0].message)
        if (err instanceof SubscriptionError) return apiError(err.message)
        throw err
      }
    },
    { bypassSubscriptionCheck: true }
  )
}
