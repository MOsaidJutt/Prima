import { NextRequest } from 'next/server'
import { withTenantApi, apiOk, apiError } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'
import { createAuditLog } from '@/lib/audit'
import { cacheDel, dashboardKey } from '@/lib/dashboard-cache'

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
    const updated = await prisma.invoice.findFirst({
      where: { id, organizationId: ctx.organizationId },
    })

    // Payment reminders are not scheduled here: the daily payment-reminder
    // sweep derives them from invoice due dates (src/lib/jobs/payment-reminder.ts),
    // so an issued invoice is picked up automatically.

    await createAuditLog({
      organizationId: ctx.organizationId,
      userId: user.id,
      action: 'UPDATE',
      entity: 'Invoice',
      entityId: id,
      newValue: { status: 'ISSUED' },
      req,
    })

    // Invalidate dashboard caches that include revenue figures
    void cacheDel(dashboardKey(ctx.organizationId, 'executive'))
    void cacheDel(dashboardKey(ctx.organizationId, 'financial'))
    void cacheDel(dashboardKey(ctx.organizationId, 'sales'))

    return apiOk(updated)
  })
}
