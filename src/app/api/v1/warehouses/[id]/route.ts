import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withTenantApi, apiOk, apiError } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'
import { createAuditLog } from '@/lib/audit'

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
})

type Params = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: Params) {
  return withTenantApi(req, 'inventory:read', async ({ ctx }) => {
    const { id } = await params
    const warehouse = await prisma.warehouse.findFirst({
      where: { id, organizationId: ctx.organizationId, deletedAt: null },
      include: {
        inventoryStock: {
          include: {
            product: {
              select: { id: true, sku: true, name: true, reorderLevel: true, status: true },
            },
          },
          orderBy: { updatedAt: 'desc' },
        },
      },
    })
    if (!warehouse) return apiError('Warehouse not found', 404)
    return apiOk(warehouse)
  })
}

export async function PATCH(req: NextRequest, { params }: Params) {
  return withTenantApi(req, 'inventory:adjust', async ({ ctx, user }) => {
    const { id } = await params
    const body = await req.json()
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) return apiError(parsed.error.issues[0].message)

    const old = await prisma.warehouse.findFirst({
      where: { id, organizationId: ctx.organizationId, deletedAt: null },
    })
    if (!old) return apiError('Warehouse not found', 404)

    if (parsed.data.isDefault) {
      await prisma.warehouse.updateMany({
        where: { organizationId: ctx.organizationId, deletedAt: null },
        data: { isDefault: false },
      })
    }

    // C-1: organizationId in the write WHERE
    const updated = await prisma.warehouse.update({
      where: { id, organizationId: ctx.organizationId },
      data: { ...parsed.data, lastModifiedBy: user.id },
    })
    await createAuditLog({
      organizationId: ctx.organizationId,
      userId: user.id,
      action: 'UPDATE',
      entity: 'Warehouse',
      entityId: id,
      oldValue: old,
      newValue: updated,
      req,
    })
    return apiOk(updated)
  })
}

export async function DELETE(req: NextRequest, { params }: Params) {
  return withTenantApi(req, 'inventory:adjust', async ({ ctx, user }) => {
    const { id } = await params
    const warehouse = await prisma.warehouse.findFirst({
      where: { id, organizationId: ctx.organizationId, deletedAt: null },
    })
    if (!warehouse) return apiError('Warehouse not found', 404)
    if (warehouse.isDefault) return apiError('Cannot delete the default warehouse')

    // C-2: include organizationId in InventoryStock query
    const hasStock = await prisma.inventoryStock.findFirst({
      where: { warehouseId: id, organizationId: ctx.organizationId, quantity: { gt: 0 } },
    })
    if (hasStock) return apiError('Cannot delete a warehouse with stock. Transfer stock first.')

    // C-1: organizationId in the write WHERE
    await prisma.warehouse.update({
      where: { id, organizationId: ctx.organizationId },
      data: { deletedAt: new Date(), lastModifiedBy: user.id },
    })
    // M-5: capture oldValue; L-3: pass req
    await createAuditLog({
      organizationId: ctx.organizationId,
      userId: user.id,
      action: 'DELETE',
      entity: 'Warehouse',
      entityId: id,
      oldValue: warehouse,
      req,
    })
    return apiOk({ success: true })
  })
}
