import { NextRequest } from 'next/server'
import { withTenantApi, apiOk, apiError } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withTenantApi(req, 'clients:read', async ({ ctx }) => {
    const { id } = await params

    const client = await prisma.client.findFirst({
      where: { id, organizationId: ctx.organizationId, deletedAt: null },
      select: { id: true },
    })
    if (!client) return apiError('Client not found', 404)

    // Get all payments for this client via their invoices
    const payments = await prisma.payment.findMany({
      where: {
        organizationId: ctx.organizationId,
        deletedAt: null,
        invoice: { clientId: id },
      },
      orderBy: { paymentDate: 'desc' },
      take: 100,
      include: {
        invoice: { select: { invoiceNumber: true } },
        recordedBy: { select: { name: true } },
      },
    })

    return apiOk({ payments })
  })
}
