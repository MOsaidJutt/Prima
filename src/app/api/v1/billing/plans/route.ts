import { NextRequest } from 'next/server'
import { withTenantApi, apiOk } from '@/lib/api-helpers'
import { getActivePlans } from '@/lib/billing/plans'

export async function GET(req: NextRequest) {
  return withTenantApi(
    req,
    'billing:read',
    async () => {
      const plans = await getActivePlans()
      return apiOk({ plans })
    },
    { bypassSubscriptionCheck: true }
  )
}
