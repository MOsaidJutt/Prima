import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withTenantApi, apiOk, apiError } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'
import { createAuditLog } from '@/lib/audit'

const transferSchema = z.object({
  productId: z.string().uuid(),
  fromWarehouseId: z.string().uuid(),
  toWarehouseId: z.string().uuid(),
  quantity: z.number().int().min(1),
  notes: z.string().optional(),
})

export async function POST(req: NextRequest) {
  return withTenantApi(req, 'inventory:transfer', async ({ ctx, user }) => {
    const body = await req.json()
    const parsed = transferSchema.safeParse(body)
    if (!parsed.success) return apiError(parsed.error.issues[0].message)

    const { productId, fromWarehouseId, toWarehouseId, quantity, notes } = parsed.data

    if (fromWarehouseId === toWarehouseId)
      return apiError('Source and destination warehouses must differ')

    const [product, fromWh, toWh] = await Promise.all([
      prisma.product.findFirst({
        where: { id: productId, organizationId: ctx.organizationId, deletedAt: null },
      }),
      prisma.warehouse.findFirst({
        where: { id: fromWarehouseId, organizationId: ctx.organizationId, deletedAt: null },
      }),
      prisma.warehouse.findFirst({
        where: { id: toWarehouseId, organizationId: ctx.organizationId, deletedAt: null },
      }),
    ])
    if (!product) return apiError('Product not found', 404)
    if (!fromWh) return apiError('Source warehouse not found', 404)
    if (!toWh) return apiError('Destination warehouse not found', 404)

    // C-2: include organizationId in all InventoryStock lookups
    const [fromStock, toStock] = await Promise.all([
      prisma.inventoryStock.findFirst({
        where: { productId, warehouseId: fromWarehouseId, organizationId: ctx.organizationId },
      }),
      prisma.inventoryStock.findFirst({
        where: { productId, warehouseId: toWarehouseId, organizationId: ctx.organizationId },
      }),
    ])

    const fromQty = fromStock?.quantity ?? 0
    const toQty = toStock?.quantity ?? 0

    if (fromQty < quantity)
      return apiError(`Insufficient stock in ${fromWh.name}. Available: ${fromQty}`)

    await prisma.$transaction(async (tx) => {
      await tx.inventoryStock.upsert({
        where: { productId_warehouseId: { productId, warehouseId: fromWarehouseId } },
        create: {
          organizationId: ctx.organizationId,
          productId,
          warehouseId: fromWarehouseId,
          quantity: fromQty - quantity,
          lastModifiedBy: user.id,
        },
        update: { quantity: fromQty - quantity, lastModifiedBy: user.id },
      })
      await tx.inventoryStock.upsert({
        where: { productId_warehouseId: { productId, warehouseId: toWarehouseId } },
        create: {
          organizationId: ctx.organizationId,
          productId,
          warehouseId: toWarehouseId,
          quantity: toQty + quantity,
          lastModifiedBy: user.id,
        },
        update: { quantity: toQty + quantity, lastModifiedBy: user.id },
      })
      await tx.inventoryTransaction.create({
        data: {
          organizationId: ctx.organizationId,
          productId,
          fromWarehouseId,
          toWarehouseId,
          type: 'TRANSFER_IN',
          quantity,
          notes,
          referenceType: 'MANUAL',
          performedBy: user.id,
        },
      })
    })

    // L-3: pass req
    await createAuditLog({
      organizationId: ctx.organizationId,
      userId: user.id,
      action: 'UPDATE',
      entity: 'InventoryTransfer',
      entityId: productId,
      newValue: { fromWarehouseId, toWarehouseId, quantity },
      req,
    })
    return apiOk({
      success: true,
      from: { warehouseId: fromWarehouseId, newQuantity: fromQty - quantity },
      to: { warehouseId: toWarehouseId, newQuantity: toQty + quantity },
    })
  })
}
