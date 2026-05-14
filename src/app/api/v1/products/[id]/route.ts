import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withTenantApi, apiOk, apiError } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'
import { createAuditLog } from '@/lib/audit'

const updateSchema = z.object({
  sku: z.string().optional(),
  barcode: z.string().optional(),
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  categoryId: z.string().uuid().nullable().optional(),
  brand: z.string().optional(),
  unitOfMeasure: z.string().optional(),
  packSize: z.number().int().min(1).optional(),
  costPrice: z.number().min(0).optional(),
  sellingPrice: z.number().min(0).optional(),
  mrp: z.number().min(0).nullable().optional(),
  taxRate: z.number().min(0).max(100).optional(),
  reorderLevel: z.number().int().min(0).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'DISCONTINUED']).optional(),
  images: z.array(z.string()).optional(),
})

type Params = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: Params) {
  return withTenantApi(req, 'products:read', async ({ ctx }) => {
    const { id } = await params
    const product = await prisma.product.findFirst({
      where: { id, organizationId: ctx.organizationId, deletedAt: null },
      include: {
        category: true,
        inventoryStock: {
          include: { warehouse: { select: { id: true, name: true, code: true, city: true } } },
        },
        inventoryTransactions: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          include: {
            fromWarehouse: { select: { name: true } },
            toWarehouse: { select: { name: true } },
            performedByUser: { select: { name: true } },
          },
        },
      },
    })
    if (!product) return apiError('Product not found', 404)
    return apiOk(product)
  })
}

export async function PATCH(req: NextRequest, { params }: Params) {
  return withTenantApi(req, 'products:update', async ({ ctx, user }) => {
    const { id } = await params
    const body = await req.json()
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) return apiError(parsed.error.issues[0].message)

    const old = await prisma.product.findFirst({
      where: { id, organizationId: ctx.organizationId, deletedAt: null },
    })
    if (!old) return apiError('Product not found', 404)

    if (parsed.data.sku && parsed.data.sku !== old.sku) {
      const dupe = await prisma.product.findFirst({
        where: { organizationId: ctx.organizationId, sku: parsed.data.sku, deletedAt: null },
      })
      if (dupe) return apiError(`SKU "${parsed.data.sku}" already exists`)
    }

    // C-1: organizationId in the write WHERE
    const updated = await prisma.product.update({
      where: { id, organizationId: ctx.organizationId },
      data: { ...parsed.data, lastModifiedBy: user.id },
    })
    await createAuditLog({
      organizationId: ctx.organizationId,
      userId: user.id,
      action: 'UPDATE',
      entity: 'Product',
      entityId: id,
      oldValue: old,
      newValue: updated,
      req,
    })
    return apiOk(updated)
  })
}

export async function DELETE(req: NextRequest, { params }: Params) {
  return withTenantApi(req, 'products:delete', async ({ ctx, user }) => {
    const { id } = await params
    const product = await prisma.product.findFirst({
      where: { id, organizationId: ctx.organizationId, deletedAt: null },
    })
    if (!product) return apiError('Product not found', 404)

    // C-1: organizationId in the write WHERE
    await prisma.product.update({
      where: { id, organizationId: ctx.organizationId },
      data: { deletedAt: new Date(), lastModifiedBy: user.id },
    })
    // M-5: capture oldValue; L-3: pass req
    await createAuditLog({
      organizationId: ctx.organizationId,
      userId: user.id,
      action: 'DELETE',
      entity: 'Product',
      entityId: id,
      oldValue: product,
      req,
    })
    return apiOk({ success: true })
  })
}
