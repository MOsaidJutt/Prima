import { NextRequest } from 'next/server'
import { withTenantApi, apiOk, apiError } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'
import { generateInvoiceNumber } from '@/lib/invoice-helpers'
import { nanoid } from 'nanoid'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withTenantApi(req, 'invoices:create', async ({ ctx, user }) => {
    const { id } = await params
    const source = await prisma.invoice.findFirst({
      where: { id, organizationId: ctx.organizationId, deletedAt: null },
      include: { lineItems: { orderBy: { sortOrder: 'asc' } } },
    })
    if (!source) return apiError('Invoice not found', 404)

    const invoiceNumber = await generateInvoiceNumber(ctx.organizationId)
    const client = await prisma.client.findFirst({
      where: { id: source.clientId, organizationId: ctx.organizationId },
      select: { paymentTerms: true },
    })
    const dueDate = new Date(Date.now() + (client?.paymentTerms ?? 30) * 24 * 60 * 60 * 1000)

    const copy = await prisma.invoice.create({
      data: {
        organizationId: ctx.organizationId,
        invoiceNumber,
        clientId: source.clientId,
        distributorId: source.distributorId,
        templateId: source.templateId,
        status: 'DRAFT',
        issueDate: new Date(),
        dueDate,
        subtotal: source.subtotal,
        taxTotal: source.taxTotal,
        discountTotal: source.discountTotal,
        shippingAmount: source.shippingAmount,
        grandTotal: source.grandTotal,
        paidAmount: 0,
        notes: source.notes,
        terms: source.terms,
        trackingToken: nanoid(32),
        createdById: user.id,
        lastModifiedBy: user.id,
        lineItems: {
          create: source.lineItems.map((li) => ({
            productId: li.productId,
            description: li.description,
            quantity: li.quantity,
            unitPrice: li.unitPrice,
            discountType: li.discountType,
            discountValue: li.discountValue,
            discountAmount: li.discountAmount,
            taxRate: li.taxRate,
            taxAmount: li.taxAmount,
            lineTotal: li.lineTotal,
            sortOrder: li.sortOrder,
          })),
        },
      },
    })

    return apiOk(copy, 201)
  })
}
