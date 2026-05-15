import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withTenantApi, apiOk, apiError } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'
import { createAuditLog } from '@/lib/audit'
import { hasPermission } from '@/lib/permissions'

const updateSchema = z.object({
  clientId: z.string().uuid().optional(),
  reportDate: z.string().datetime().optional(),
  visitType: z.enum(['IN_PERSON', 'PHONE', 'VIRTUAL', 'EMAIL']).optional(),
  visitNotes: z.string().optional(),
  outcome: z.string().optional(),
  followUpDate: z.string().datetime().optional().nullable(),
  satisfaction: z.number().int().min(1).max(5).optional().nullable(),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
  lineItems: z
    .array(
      z.object({
        productId: z.string().uuid(),
        quantity: z.number().int().min(1),
        unitPrice: z.number().min(0),
        discountType: z.enum(['PERCENT', 'FLAT']).optional(),
        discountValue: z.number().min(0).optional(),
      })
    )
    .optional(),
})

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withTenantApi(req, 'dsr:read', async ({ ctx, user }) => {
    const { id } = await params
    const entry = await prisma.dSREntry.findFirst({
      where: { id, organizationId: ctx.organizationId, deletedAt: null },
      include: {
        client: { select: { id: true, companyName: true, code: true, city: true, phone: true } },
        submittedBy: { select: { id: true, name: true, email: true } },
        approvedBy: { select: { id: true, name: true } },
        lineItems: {
          include: {
            product: { select: { id: true, name: true, sku: true, unitOfMeasure: true } },
          },
        },
      },
    })
    if (!entry) return apiError('DSR not found', 404)

    // Ownership check unless user has dsr:read_all
    const canReadAll = hasPermission(user.permissions, 'dsr:read_all')
    if (!canReadAll && entry.submittedById !== user.id) return apiError('Forbidden', 403)

    return apiOk(entry)
  })
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withTenantApi(req, 'dsr:update_own', async ({ ctx, user }) => {
    const { id } = await params
    const entry = await prisma.dSREntry.findFirst({
      where: { id, organizationId: ctx.organizationId, deletedAt: null },
    })
    if (!entry) return apiError('DSR not found', 404)
    if (entry.status !== 'DRAFT') return apiError('Only DRAFT DSRs can be edited', 422)

    const canUpdateAny = hasPermission(user.permissions, 'dsr:update_any')
    if (!canUpdateAny && entry.submittedById !== user.id) return apiError('Forbidden', 403)

    const body = await req.json()
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) return apiError(parsed.error.issues[0]?.message ?? 'Validation error')
    const d = parsed.data

    // Recalculate totals if line items provided
    let lineItemsUpdate: object | undefined
    let subtotal = Number(entry.subtotal)
    let taxTotal = Number(entry.taxTotal)
    let grandTotal = Number(entry.grandTotal)

    if (d.lineItems) {
      // Batch-fetch all products in one query (fixes N+1)
      const pids = d.lineItems.map((li) => li.productId)
      const products = pids.length
        ? await prisma.product.findMany({
            where: { id: { in: pids }, organizationId: ctx.organizationId, deletedAt: null },
            select: { id: true, taxRate: true },
          })
        : []
      const productMap = Object.fromEntries(products.map((p) => [p.id, p]))

      const lineItemsWithTotals = d.lineItems.map((li) => {
        const product = productMap[li.productId]
        const lineBase = li.quantity * li.unitPrice
        let discountAmount = 0
        if (li.discountType === 'PERCENT' && li.discountValue)
          discountAmount = (lineBase * li.discountValue) / 100
        else if (li.discountType === 'FLAT' && li.discountValue) discountAmount = li.discountValue
        const taxRate = Number(product?.taxRate ?? 0)
        const taxAmount = ((lineBase - discountAmount) * taxRate) / 100
        return {
          productId: li.productId,
          quantity: li.quantity,
          unitPrice: li.unitPrice,
          discountType: li.discountType ?? null,
          discountValue: li.discountValue ?? null,
          discountAmount,
          taxRate,
          taxAmount,
          lineTotal: lineBase - discountAmount + taxAmount,
        }
      })
      subtotal = lineItemsWithTotals.reduce(
        (s, li) => s + li.quantity * li.unitPrice - li.discountAmount,
        0
      )
      taxTotal = lineItemsWithTotals.reduce((s, li) => s + li.taxAmount, 0)
      grandTotal = subtotal + taxTotal
      lineItemsUpdate = {
        deleteMany: { dsrEntryId: id },
        create: lineItemsWithTotals,
      }
    }

    const updated = await prisma.dSREntry.update({
      where: { id },
      data: {
        ...(d.clientId ? { clientId: d.clientId } : {}),
        ...(d.reportDate ? { reportDate: new Date(d.reportDate) } : {}),
        ...(d.visitType ? { visitType: d.visitType } : {}),
        ...(d.visitNotes !== undefined ? { visitNotes: d.visitNotes } : {}),
        ...(d.outcome !== undefined ? { outcome: d.outcome } : {}),
        ...(d.followUpDate !== undefined
          ? { followUpDate: d.followUpDate ? new Date(d.followUpDate) : null }
          : {}),
        ...(d.satisfaction !== undefined ? { satisfaction: d.satisfaction } : {}),
        ...(d.latitude !== undefined ? { latitude: d.latitude } : {}),
        ...(d.longitude !== undefined ? { longitude: d.longitude } : {}),
        ...(d.lineItems ? { subtotal, taxTotal, grandTotal } : {}),
        ...(lineItemsUpdate ? { lineItems: lineItemsUpdate } : {}),
        lastModifiedBy: user.id,
      },
      include: { lineItems: true },
    })

    await createAuditLog({
      organizationId: ctx.organizationId,
      userId: user.id,
      action: 'UPDATE',
      entity: 'DSREntry',
      entityId: id,
      req,
    })

    return apiOk(updated)
  })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withTenantApi(req, 'dsr:delete_own', async ({ ctx, user }) => {
    const { id } = await params
    const entry = await prisma.dSREntry.findFirst({
      where: { id, organizationId: ctx.organizationId, deletedAt: null },
    })
    if (!entry) return apiError('DSR not found', 404)
    if (entry.status !== 'DRAFT') return apiError('Only DRAFT DSRs can be deleted', 422)
    if (entry.submittedById !== user.id) return apiError('Forbidden', 403)

    await prisma.dSREntry.update({
      where: { id },
      data: { deletedAt: new Date(), lastModifiedBy: user.id },
    })
    await createAuditLog({
      organizationId: ctx.organizationId,
      userId: user.id,
      action: 'DELETE',
      entity: 'DSREntry',
      entityId: id,
      req,
    })
    return apiOk({ success: true })
  })
}
