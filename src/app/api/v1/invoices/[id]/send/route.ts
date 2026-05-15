import { NextRequest } from 'next/server'
import { withTenantApi, apiOk, apiError } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'
import { createAuditLog } from '@/lib/audit'
import { sendInvoiceEmail } from '@/lib/email'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withTenantApi(req, 'invoices:send', async ({ ctx, user, org }) => {
    const { id } = await params
    const invoice = await prisma.invoice.findFirst({
      where: { id, organizationId: ctx.organizationId, deletedAt: null },
      include: {
        client: { select: { companyName: true, email: true, contactName: true } },
      },
    })
    if (!invoice) return apiError('Invoice not found', 404)
    if (!['DRAFT', 'ISSUED', 'OVERDUE', 'PARTIALLY_PAID'].includes(invoice.status)) {
      return apiError('Invoice cannot be sent in its current state', 422)
    }
    if (!invoice.client.email) return apiError('Client has no email address', 422)

    // Issue it if still a draft
    if (invoice.status === 'DRAFT') {
      await prisma.invoice.updateMany({
        where: { id, organizationId: ctx.organizationId },
        data: { status: 'ISSUED', lastModifiedBy: user.id },
      })
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    const invoiceUrl = `${appUrl}/invoice/${invoice.trackingToken}`

    await sendInvoiceEmail({
      to: invoice.client.email,
      clientName: invoice.client.contactName ?? invoice.client.companyName,
      orgName: org.name,
      invoiceNumber: invoice.invoiceNumber,
      grandTotal: Number(invoice.grandTotal),
      dueDate: invoice.dueDate ?? undefined,
      invoiceUrl,
    })

    await prisma.invoice.updateMany({
      where: { id, organizationId: ctx.organizationId },
      data: { emailSentAt: new Date(), lastModifiedBy: user.id },
    })

    await createAuditLog({
      organizationId: ctx.organizationId,
      userId: user.id,
      action: 'UPDATE',
      entity: 'Invoice',
      entityId: id,
      newValue: { emailSentAt: new Date() },
      req,
    })

    return apiOk({ success: true, sentTo: invoice.client.email })
  })
}
