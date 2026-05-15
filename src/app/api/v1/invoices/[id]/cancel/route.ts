import { NextRequest } from 'next/server'
import { withTenantApi, apiOk, apiError } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'
import { createAuditLog } from '@/lib/audit'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withTenantApi(req, 'invoices:update', async ({ ctx, user }) => {
    const { id } = await params
    const invoice = await prisma.invoice.findFirst({
      where: { id, organizationId: ctx.organizationId, deletedAt: null },
      select: { status: true },
    })
    if (!invoice) return apiError('Invoice not found', 404)
    if (['PAID', 'CANCELLED'].includes(invoice.status))
      return apiError('Cannot cancel a paid or already cancelled invoice', 422)

    await prisma.invoice.updateMany({
      where: { id, organizationId: ctx.organizationId },
      data: { status: 'CANCELLED', lastModifiedBy: user.id },
    })
    const updated = await prisma.invoice.findFirst({ where: { id } })

    await createAuditLog({
      organizationId: ctx.organizationId,
      userId: user.id,
      action: 'UPDATE',
      entity: 'Invoice',
      entityId: id,
      newValue: { status: 'CANCELLED' },
      req,
    })
    return apiOk(updated)
  })
}
