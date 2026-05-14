import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withTenantApi, apiOk, apiError } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'
import { createAuditLog } from '@/lib/audit'
import { createNotification } from '@/lib/notifications'

const adjustSchema = z.object({
  productId: z.string().uuid(),
  warehouseId: z.string().uuid(),
  quantity: z.number().int(),
  reason: z.string().min(1),
  notes: z.string().optional(),
})

export async function POST(req: NextRequest) {
  return withTenantApi(req, 'inventory:adjust', async ({ ctx, user }) => {
    const body = await req.json()
    const parsed = adjustSchema.safeParse(body)
    if (!parsed.success) return apiError(parsed.error.issues[0].message)

    const { productId, warehouseId, quantity, reason, notes } = parsed.data

    const [product, warehouse] = await Promise.all([
      prisma.product.findFirst({
        where: { id: productId, organizationId: ctx.organizationId, deletedAt: null },
      }),
      prisma.warehouse.findFirst({
        where: { id: warehouseId, organizationId: ctx.organizationId, deletedAt: null },
      }),
    ])
    if (!product) return apiError('Product not found', 404)
    if (!warehouse) return apiError('Warehouse not found', 404)

    // C-2: include organizationId in InventoryStock lookup
    const existing = await prisma.inventoryStock.findFirst({
      where: { productId, warehouseId, organizationId: ctx.organizationId },
    })
    const currentQty = existing?.quantity ?? 0
    const newQty = currentQty + quantity

    if (newQty < 0)
      return apiError(`Insufficient stock. Current: ${currentQty}, Adjustment: ${quantity}`)

    const txType = quantity >= 0 ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT'

    const result = await prisma.$transaction(async (tx) => {
      await tx.inventoryStock.upsert({
        where: { productId_warehouseId: { productId, warehouseId } },
        create: {
          organizationId: ctx.organizationId,
          productId,
          warehouseId,
          quantity: newQty,
          lastModifiedBy: user.id,
        },
        update: { quantity: newQty, lastModifiedBy: user.id },
      })

      return tx.inventoryTransaction.create({
        data: {
          organizationId: ctx.organizationId,
          productId,
          toWarehouseId: quantity >= 0 ? warehouseId : undefined,
          fromWarehouseId: quantity < 0 ? warehouseId : undefined,
          type: txType,
          quantity: Math.abs(quantity),
          reason,
          notes,
          referenceType: 'MANUAL',
          performedBy: user.id,
        },
      })
    })

    if (newQty <= product.reorderLevel) {
      await createNotification({
        organizationId: ctx.organizationId,
        userId: user.id,
        type: 'low_stock',
        title: `Low stock: ${product.name}`,
        body: `${product.name} in ${warehouse.name} is at ${newQty} units (reorder level: ${product.reorderLevel})`,
        data: {
          entityType: 'Product',
          entityId: productId,
          actionUrl: `/admin/products/${productId}`,
        },
      })
    }

    // L-3: pass req to audit
    await createAuditLog({
      organizationId: ctx.organizationId,
      userId: user.id,
      action: 'UPDATE',
      entity: 'InventoryStock',
      entityId: productId,
      newValue: { warehouseId, newQty, adjustment: quantity, reason },
      req,
    })

    return apiOk({ success: true, newQuantity: newQty, transaction: result })
  })
}
