import { NextRequest } from 'next/server'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { withTenantApi, apiOk, apiError } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'
import { createAuditLog } from '@/lib/audit'
import { sendPaymentReceiptEmail } from '@/lib/email'
import { recalculatePaymentScore } from '@/lib/ai/payment-scoring'
import { cacheDel, dashboardKey } from '@/lib/dashboard-cache'

const createSchema = z.object({
  amount: z.number().positive(),
  paymentDate: z.string().datetime().optional(),
  method: z.enum(['CASH', 'BANK', 'CHEQUE', 'CARD', 'WALLET', 'OTHER']).default('CASH'),
  referenceNumber: z.string().optional(),
  bankDetails: z.record(z.unknown()).optional(),
  receiptUrl: z.string().url().optional(),
  notes: z.string().optional(),
  sendReceipt: z.boolean().default(false),
})

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withTenantApi(req, 'invoices:read', async ({ ctx }) => {
    const { id } = await params
    const payments = await prisma.payment.findMany({
      where: { invoiceId: id, organizationId: ctx.organizationId, deletedAt: null },
      orderBy: { paymentDate: 'desc' },
      include: { recordedBy: { select: { id: true, name: true } } },
    })
    return apiOk(payments)
  })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withTenantApi(req, 'invoices:record_payment', async ({ ctx, user, org }) => {
    const { id } = await params
    const body = await req.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) return apiError(parsed.error.issues[0]?.message ?? 'Validation error')
    const d = parsed.data

    const invoice = await prisma.invoice.findFirst({
      where: { id, organizationId: ctx.organizationId, deletedAt: null },
      include: {
        client: {
          select: {
            id: true,
            email: true,
            companyName: true,
            contactName: true,
            currentBalance: true,
          },
        },
      },
    })
    if (!invoice) return apiError('Invoice not found', 404)
    if (['PAID', 'CANCELLED', 'DRAFT'].includes(invoice.status)) {
      return apiError('Cannot record payment for an invoice in this state', 422)
    }

    const newPaid = Number(invoice.paidAmount) + d.amount
    if (newPaid > Number(invoice.grandTotal) + 0.01) {
      return apiError('Payment amount exceeds invoice balance', 422)
    }

    const newStatus = newPaid >= Number(invoice.grandTotal) - 0.01 ? 'PAID' : 'PARTIALLY_PAID'

    const result = await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          organizationId: ctx.organizationId,
          invoiceId: id,
          amount: d.amount,
          paymentDate: d.paymentDate ? new Date(d.paymentDate) : new Date(),
          method: d.method,
          referenceNumber: d.referenceNumber ?? null,
          bankDetails: d.bankDetails ? (d.bankDetails as Prisma.InputJsonValue) : undefined,
          receiptUrl: d.receiptUrl ?? null,
          notes: d.notes ?? null,
          recordedById: user.id,
          lastModifiedBy: user.id,
        },
      })

      await tx.invoice.update({
        where: { id },
        data: { paidAmount: newPaid, status: newStatus, lastModifiedBy: user.id },
      })

      // Update client's outstanding balance
      const outstandingDelta = -d.amount
      await tx.client.update({
        where: { id: invoice.client.id },
        data: { currentBalance: { increment: outstandingDelta } },
      })

      return payment
    })

    await createAuditLog({
      organizationId: ctx.organizationId,
      userId: user.id,
      action: 'CREATE',
      entity: 'Payment',
      entityId: result.id,
      newValue: { amount: d.amount, method: d.method, invoiceStatus: newStatus },
      req,
    })

    // Recalculate payment behavior score asynchronously (non-blocking)
    recalculatePaymentScore(invoice.client.id, ctx.organizationId).catch(() => {})

    // Invalidate financial dashboard caches
    void cacheDel(dashboardKey(ctx.organizationId, 'executive'))
    void cacheDel(dashboardKey(ctx.organizationId, 'financial'))
    void cacheDel(dashboardKey(ctx.organizationId, 'clients'))

    // Optional receipt email
    if (d.sendReceipt && invoice.client.email) {
      await sendPaymentReceiptEmail({
        to: invoice.client.email,
        clientName: invoice.client.contactName ?? invoice.client.companyName,
        orgName: org.name,
        invoiceNumber: invoice.invoiceNumber,
        amount: d.amount,
        paymentDate: d.paymentDate ? new Date(d.paymentDate) : new Date(),
        method: d.method,
        balance: Number(invoice.grandTotal) - newPaid,
      }).catch(() => {}) // non-fatal
    }

    return apiOk({ payment: result, invoiceStatus: newStatus, paidAmount: newPaid }, 201)
  })
}
