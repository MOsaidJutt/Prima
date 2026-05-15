import { NextRequest } from 'next/server'
import { withTenantApi, apiOk, apiError } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'
import { createAuditLog } from '@/lib/audit'
import { schedulePaymentReminders } from '@/lib/queues'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withTenantApi(req, 'invoices:update', async ({ ctx, user }) => {
    const { id } = await params
    const invoice = await prisma.invoice.findFirst({
      where: { id, organizationId: ctx.organizationId, deletedAt: null },
      select: { status: true, dueDate: true, grandTotal: true, clientId: true },
    })
    if (!invoice) return apiError('Invoice not found', 404)
    if (invoice.status !== 'DRAFT') return apiError('Only DRAFT invoices can be issued', 422)

    await prisma.invoice.updateMany({
      where: { id, organizationId: ctx.organizationId },
      data: { status: 'ISSUED', lastModifiedBy: user.id },
    })
    const updated = await prisma.invoice.findFirst({ where: { id } })

    // Schedule payment reminders if due date set
    if (invoice.dueDate) {
      await schedulePaymentReminders(id, invoice.dueDate, ctx.organizationId)
    }

    await createAuditLog({
      organizationId: ctx.organizationId,
      userId: user.id,
      action: 'UPDATE',
      entity: 'Invoice',
      entityId: id,
      newValue: { status: 'ISSUED' },
      req,
    })

    return apiOk(updated)
  })
}
