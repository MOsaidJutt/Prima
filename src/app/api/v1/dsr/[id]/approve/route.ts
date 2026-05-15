import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withTenantApi, apiOk, apiError } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'
import { createAuditLog } from '@/lib/audit'
import { nanoid } from 'nanoid'

const schema = z.object({
  createInvoice: z.boolean().default(true),
})

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withTenantApi(req, 'dsr:approve', async ({ ctx, user }) => {
    const { id } = await params
    const body = await req.json().catch(() => ({}))
    const { createInvoice } = schema.parse(body)

    const entry = await prisma.dSREntry.findFirst({
      where: { id, organizationId: ctx.organizationId, deletedAt: null },
      include: {
        lineItems: { include: { product: true } },
        client: { select: { id: true, paymentTerms: true } },
      },
    })
    if (!entry) return apiError('DSR not found', 404)
    if (entry.status !== 'SUBMITTED') return apiError('DSR is not in SUBMITTED state', 422)

    // Fetch default warehouse for inventory deduction
    const defaultWarehouse = await prisma.warehouse.findFirst({
      where: { organizationId: ctx.organizationId, isDefault: true, deletedAt: null },
    })

    // All operations in a single transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Approve DSR
      const approved = await tx.dSREntry.update({
        where: { id },
        data: {
          status: 'APPROVED',
          approvedById: user.id,
          approvedAt: new Date(),
          lastModifiedBy: user.id,
        },
      })

      // 2. Deduct inventory for each line item
      if (defaultWarehouse) {
        for (const li of entry.lineItems) {
          const stock = await tx.inventoryStock.findFirst({
            where: {
              productId: li.productId,
              warehouseId: defaultWarehouse.id,
              organizationId: ctx.organizationId,
            },
          })
          if (stock) {
            await tx.inventoryStock.update({
              where: { id: stock.id },
              data: { quantity: Math.max(0, stock.quantity - li.quantity) },
            })
          }
          await tx.inventoryTransaction.create({
            data: {
              organizationId: ctx.organizationId,
              productId: li.productId,
              fromWarehouseId: defaultWarehouse.id,
              type: 'SALE',
              quantity: li.quantity,
              unitCost: li.unitPrice,
              referenceType: 'DSR',
              referenceId: id,
              reason: `DSR approval: ${id}`,
              performedBy: user.id,
            },
          })
        }
      }

      // 3. Optionally create invoice draft
      let invoice = null
      if (createInvoice) {
        // Generate sequential invoice number
        const lastInvoice = await tx.invoice.findFirst({
          where: { organizationId: ctx.organizationId },
          orderBy: { createdAt: 'desc' },
          select: { invoiceNumber: true },
        })
        const template = await tx.invoiceTemplate.findFirst({
          where: { organizationId: ctx.organizationId, isDefault: true, deletedAt: null },
        })
        const year = new Date().getFullYear()
        const prefix = template?.invoiceNumberPrefix ?? 'INV'
        const padding = template?.invoiceNumberPadding ?? 4
        const includeYear = template?.invoiceNumberIncludeYear ?? true
        let nextNum = 1
        if (lastInvoice) {
          const parts = lastInvoice.invoiceNumber.split('-')
          const lastNum = parseInt(parts[parts.length - 1], 10)
          if (!isNaN(lastNum)) nextNum = lastNum + 1
        }
        const invNum = includeYear
          ? `${prefix}-${year}-${String(nextNum).padStart(padding, '0')}`
          : `${prefix}-${String(nextNum).padStart(padding, '0')}`

        const paymentTerms = entry.client.paymentTerms ?? 30
        const dueDate = new Date(Date.now() + paymentTerms * 24 * 60 * 60 * 1000)

        invoice = await tx.invoice.create({
          data: {
            organizationId: ctx.organizationId,
            invoiceNumber: invNum,
            clientId: entry.clientId,
            templateId: template?.id ?? null,
            dsrEntryId: id,
            status: 'DRAFT',
            issueDate: new Date(),
            dueDate,
            subtotal: entry.subtotal,
            taxTotal: entry.taxTotal,
            discountTotal: 0,
            shippingAmount: 0,
            grandTotal: entry.grandTotal,
            paidAmount: 0,
            trackingToken: nanoid(32),
            createdById: user.id,
            lastModifiedBy: user.id,
            lineItems: {
              create: entry.lineItems.map((li, idx) => ({
                productId: li.productId,
                description: li.product.name,
                quantity: li.quantity,
                unitPrice: li.unitPrice,
                discountType: li.discountType,
                discountValue: li.discountValue,
                discountAmount: li.discountAmount,
                taxRate: li.taxRate,
                taxAmount: li.taxAmount,
                lineTotal: li.lineTotal,
                sortOrder: idx,
              })),
            },
          },
        })

        // Link invoice to DSR
        await tx.dSREntry.update({ where: { id }, data: { invoiceId: invoice.id } })
      }

      return { dsr: approved, invoice }
    })

    await createAuditLog({
      organizationId: ctx.organizationId,
      userId: user.id,
      action: 'UPDATE',
      entity: 'DSREntry',
      entityId: id,
      newValue: { status: 'APPROVED', invoiceId: result.invoice?.id },
      req,
    })

    return apiOk(result)
  })
}
