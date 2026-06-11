import { NextRequest } from 'next/server'
import { withTenantApi, apiOk } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  return withTenantApi(
    req,
    'billing:read',
    async ({ ctx }) => {
      const url = new URL(req.url)
      const rawPage = Number(url.searchParams.get('page'))
      const page = Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1
      const pageSize = 20

      const where = { organizationId: ctx.organizationId, deletedAt: null }
      const [invoices, total] = await Promise.all([
        prisma.organizationInvoice.findMany({
          where,
          orderBy: { issueDate: 'desc' },
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        prisma.organizationInvoice.count({ where }),
      ])

      return apiOk({ invoices, total, page, pageSize })
    },
    { bypassSubscriptionCheck: true }
  )
}
