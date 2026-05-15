import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withTenantApi, apiOk, apiError } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'
import { createAuditLog } from '@/lib/audit'

const lineItemSchema = z.object({
  productId: z.string().uuid().optional().nullable(),
  description: z.string().min(1),
  quantity: z.number().int().min(1),
  unitPrice: z.number().min(0),
  discountType: z.enum(['PERCENT', 'FLAT']).optional().nullable(),
  discountValue: z.number().min(0).optional().nullable(),
  taxRate: z.number().min(0).max(100).default(0),
  sortOrder: z.number().int().default(0),
})

const updateSchema = z.object({
  clientId: z.string().uuid().optional(),
  distributorId: z.string().uuid().optional().nullable(),
  templateId: z.string().uuid().optional().nullable(),
  issueDate: z.string().datetime().optional(),
  dueDate: z.string().datetime().optional().nullable(),
  shippingAmount: z.number().min(0).optional(),
  notes: z.string().optional().nullable(),
  terms: z.string().optional().nullable(),
  lineItems: z.array(lineItemSchema).optional(),
})

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withTenantApi(req, 'invoices:read', async ({ ctx }) => {
    const { id } = await params
    const invoice = await prisma.invoice.findFirst({
      where: { id, organizationId: ctx.organizationId, deletedAt: null },
      include: {
        client: true,
        distributor: { select: { id: true, companyName: true, code: true } },
        template: true,
        lineItems: {
          orderBy: { sortOrder: 'asc' },
          include: { product: { select: { id: true, name: true, sku: true } } },
        },
        payments: {
          where: { deletedAt: null },
          orderBy: { paymentDate: 'desc' },
          include: { recordedBy: { select: { id: true, name: true } } },
        },
        createdBy: { select: { id: true, name: true } },
      },
    })
    if (!invoice) return apiError('Invoice not found', 404)
    return apiOk(invoice)
  })
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withTenantApi(req, 'invoices:update', async ({ ctx, user }) => {
    const { id } = await params
    const invoice = await prisma.invoice.findFirst({
      where: { id, organizationId: ctx.organizationId, deletedAt: null },
    })
    if (!invoice) return apiError('Invoice not found', 404)
    if (invoice.status !== 'DRAFT') return apiError('Only DRAFT invoices can be edited', 422)

    const body = await req.json()
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) return apiError(parsed.error.issues[0]?.message ?? 'Validation error')
    const d = parsed.data

    let subtotal = Number(invoice.subtotal)
    let taxTotal = Number(invoice.taxTotal)
    let discountTotal = Number(invoice.discountTotal)
    let grandTotal = Number(invoice.grandTotal)
    let lineItemsUpdate: object | undefined

    if (d.lineItems) {
      const calc = d.lineItems.map((li) => {
        const lineBase = li.quantity * li.unitPrice
        let discountAmount = 0
        if (li.discountType === 'PERCENT' && li.discountValue)
          discountAmount = (lineBase * li.discountValue) / 100
        else if (li.discountType === 'FLAT' && li.discountValue) discountAmount = li.discountValue
        const taxAmount = ((lineBase - discountAmount) * li.taxRate) / 100
        return {
          ...li,
          discountAmount,
          taxAmount,
          lineTotal: lineBase - discountAmount + taxAmount,
        }
      })
      subtotal = calc.reduce((s, li) => s + li.quantity * li.unitPrice - li.discountAmount, 0)
      taxTotal = calc.reduce((s, li) => s + li.taxAmount, 0)
      discountTotal = calc.reduce((s, li) => s + li.discountAmount, 0)
      grandTotal = subtotal + taxTotal + (d.shippingAmount ?? Number(invoice.shippingAmount))
      lineItemsUpdate = {
        deleteMany: { invoiceId: id },
        create: calc.map((li) => ({
          productId: li.productId ?? null,
          description: li.description,
          quantity: li.quantity,
          unitPrice: li.unitPrice,
          discountType: li.discountType ?? null,
          discountValue: li.discountValue ?? null,
          discountAmount: li.discountAmount,
          taxRate: li.taxRate,
          taxAmount: li.taxAmount,
          lineTotal: li.lineTotal,
          sortOrder: li.sortOrder,
        })),
      }
    }

    const updated = await prisma.invoice.update({
      where: { id },
      data: {
        ...(d.clientId ? { clientId: d.clientId } : {}),
        ...(d.distributorId !== undefined ? { distributorId: d.distributorId } : {}),
        ...(d.templateId !== undefined ? { templateId: d.templateId } : {}),
        ...(d.issueDate ? { issueDate: new Date(d.issueDate) } : {}),
        ...(d.dueDate !== undefined ? { dueDate: d.dueDate ? new Date(d.dueDate) : null } : {}),
        ...(d.shippingAmount !== undefined ? { shippingAmount: d.shippingAmount } : {}),
        ...(d.notes !== undefined ? { notes: d.notes } : {}),
        ...(d.terms !== undefined ? { terms: d.terms } : {}),
        ...(d.lineItems ? { subtotal, taxTotal, discountTotal, grandTotal } : {}),
        ...(lineItemsUpdate ? { lineItems: lineItemsUpdate } : {}),
        lastModifiedBy: user.id,
        pdfUrl: null, // invalidate cached PDF on edit
        pdfGeneratedAt: null,
      },
      include: { lineItems: true },
    })

    await createAuditLog({
      organizationId: ctx.organizationId,
      userId: user.id,
      action: 'UPDATE',
      entity: 'Invoice',
      entityId: id,
      // H-3: capture pre-update state for audit diff
      oldValue: {
        status: invoice.status,
        grandTotal: invoice.grandTotal,
        lineItemCount: undefined,
      },
      newValue: { grandTotal: updated.grandTotal },
      req,
    })
    return apiOk(updated)
  })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withTenantApi(req, 'invoices:delete', async ({ ctx, user }) => {
    const { id } = await params
    const invoice = await prisma.invoice.findFirst({
      where: { id, organizationId: ctx.organizationId, deletedAt: null },
    })
    if (!invoice) return apiError('Invoice not found', 404)
    if (!['DRAFT', 'CANCELLED'].includes(invoice.status))
      return apiError('Only DRAFT or CANCELLED invoices can be deleted', 422)

    await prisma.invoice.update({
      where: { id },
      data: { deletedAt: new Date(), lastModifiedBy: user.id },
    })
    await createAuditLog({
      organizationId: ctx.organizationId,
      userId: user.id,
      action: 'DELETE',
      entity: 'Invoice',
      entityId: id,
      req,
    })
    return apiOk({ success: true })
  })
}
