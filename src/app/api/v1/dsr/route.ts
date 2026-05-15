import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withTenantApi, apiOk, apiError } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'
import { createAuditLog } from '@/lib/audit'
import { hasPermission } from '@/lib/permissions'

const lineItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().min(1),
  unitPrice: z.number().min(0),
  discountType: z.enum(['PERCENT', 'FLAT']).optional(),
  discountValue: z.number().min(0).optional(),
})

const createSchema = z.object({
  clientId: z.string().uuid(),
  reportDate: z.string().datetime(),
  visitType: z.enum(['IN_PERSON', 'PHONE', 'VIRTUAL', 'EMAIL']).default('IN_PERSON'),
  visitNotes: z.string().optional(),
  outcome: z.string().optional(),
  followUpDate: z.string().datetime().optional().nullable(),
  satisfaction: z.number().int().min(1).max(5).optional().nullable(),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
  lineItems: z.array(lineItemSchema).min(0).default([]),
  saveDraft: z.boolean().default(true),
})

export async function GET(req: NextRequest) {
  return withTenantApi(req, 'dsr:read', async ({ ctx, user }) => {
    const url = new URL(req.url)
    const page = Math.max(1, Number(url.searchParams.get('page') ?? 1))
    const pageSize = Math.min(100, Number(url.searchParams.get('pageSize') ?? 25))
    const status = url.searchParams.get('status') ?? ''
    const all = url.searchParams.get('all') === 'true'

    // all=true requires dsr:read_all permission
    const canReadAll = hasPermission(user.permissions, 'dsr:read_all')
    const scopeToUser = !all || !canReadAll

    const where = {
      organizationId: ctx.organizationId,
      deletedAt: null,
      ...(scopeToUser ? { submittedById: user.id } : {}),
      ...(status ? { status: status as 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' } : {}),
    }

    const [entries, total] = await Promise.all([
      prisma.dSREntry.findMany({
        where,
        orderBy: { reportDate: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          client: { select: { id: true, companyName: true, code: true, city: true } },
          submittedBy: { select: { id: true, name: true } },
          _count: { select: { lineItems: true } },
        },
      }),
      prisma.dSREntry.count({ where }),
    ])

    return apiOk({ data: entries, total, page, pageSize })
  })
}

export async function POST(req: NextRequest) {
  return withTenantApi(req, 'dsr:create', async ({ ctx, user }) => {
    const body = await req.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) return apiError(parsed.error.issues[0]?.message ?? 'Validation error')

    const d = parsed.data

    // Verify client belongs to this org
    const client = await prisma.client.findFirst({
      where: { id: d.clientId, organizationId: ctx.organizationId, deletedAt: null },
    })
    if (!client) return apiError('Client not found', 404)

    // Batch-fetch all products in one query (fixes N+1)
    const productIds = d.lineItems.map((li) => li.productId)
    const products = productIds.length
      ? await prisma.product.findMany({
          where: { id: { in: productIds }, organizationId: ctx.organizationId, deletedAt: null },
          select: { id: true, sellingPrice: true, taxRate: true },
        })
      : []
    const productMap = Object.fromEntries(products.map((p) => [p.id, p]))

    const lineItemsWithTotals = d.lineItems.map((li) => {
      const product = productMap[li.productId]
      const unitPrice = li.unitPrice ?? Number(product?.sellingPrice ?? 0)
      const lineBase = li.quantity * unitPrice
      let discountAmount = 0
      if (li.discountType === 'PERCENT' && li.discountValue) {
        discountAmount = (lineBase * li.discountValue) / 100
      } else if (li.discountType === 'FLAT' && li.discountValue) {
        discountAmount = li.discountValue
      }
      const taxRate = Number(product?.taxRate ?? 0)
      const taxAmount = ((lineBase - discountAmount) * taxRate) / 100
      return {
        productId: li.productId,
        quantity: li.quantity,
        unitPrice,
        discountType: li.discountType ?? null,
        discountValue: li.discountValue ?? null,
        discountAmount,
        taxRate,
        taxAmount,
        lineTotal: lineBase - discountAmount + taxAmount,
      }
    })

    const subtotal = lineItemsWithTotals.reduce(
      (s, li) => s + li.quantity * li.unitPrice - li.discountAmount,
      0
    )
    const taxTotal = lineItemsWithTotals.reduce((s, li) => s + li.taxAmount, 0)
    const grandTotal = subtotal + taxTotal

    const dsr = await prisma.dSREntry.create({
      data: {
        organizationId: ctx.organizationId,
        submittedById: user.id,
        clientId: d.clientId,
        reportDate: new Date(d.reportDate),
        visitType: d.visitType,
        visitNotes: d.visitNotes ?? null,
        outcome: d.outcome ?? null,
        followUpDate: d.followUpDate ? new Date(d.followUpDate) : null,
        satisfaction: d.satisfaction ?? null,
        latitude: d.latitude ?? null,
        longitude: d.longitude ?? null,
        status: d.saveDraft ? 'DRAFT' : 'SUBMITTED',
        subtotal,
        taxTotal,
        discountTotal: 0,
        grandTotal,
        lastModifiedBy: user.id,
        lineItems: { create: lineItemsWithTotals },
      },
      include: { lineItems: true, client: true },
    })

    await createAuditLog({
      organizationId: ctx.organizationId,
      userId: user.id,
      action: 'CREATE',
      entity: 'DSREntry',
      entityId: dsr.id,
      newValue: { status: dsr.status, grandTotal: dsr.grandTotal },
      req,
    })

    return apiOk(dsr, 201)
  })
}
