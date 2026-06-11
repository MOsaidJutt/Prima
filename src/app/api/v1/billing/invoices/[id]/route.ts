import { NextRequest } from 'next/server'
import { withTenantApi, apiOk, apiError } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withTenantApi(
    req,
    'billing:read',
    async ({ ctx }) => {
      const { id } = await params

      const invoice = await prisma.organizationInvoice.findFirst({
        where: { id, organizationId: ctx.organizationId, deletedAt: null },
      })
      if (!invoice) return apiError('Invoice not found', 404)

      return apiOk(invoice)
    },
    { bypassSubscriptionCheck: true }
  )
}
