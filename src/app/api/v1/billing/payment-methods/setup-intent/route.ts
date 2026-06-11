import { NextRequest } from 'next/server'
import { withTenantApi, apiOk, apiError } from '@/lib/api-helpers'
import { createCardSetupIntent } from '@/lib/billing/payment-methods'

export async function POST(req: NextRequest) {
  return withTenantApi(
    req,
    'billing:update',
    async ({ ctx }) => {
      try {
        const intent = await createCardSetupIntent(ctx.organizationId)
        return apiOk(intent)
      } catch (err) {
        console.error('[setup-intent]', err)
        return apiError('Could not start card setup. Please try again later.', 500)
      }
    },
    { bypassSubscriptionCheck: true }
  )
}
