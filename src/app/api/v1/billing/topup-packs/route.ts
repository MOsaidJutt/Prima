import { NextRequest } from 'next/server'
import { withTenantApi, apiOk } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  return withTenantApi(
    req,
    'billing:read',
    async () => {
      const packs = await prisma.tokenTopUpPack.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
      })
      return apiOk({ packs })
    },
    { bypassSubscriptionCheck: true }
  )
}
