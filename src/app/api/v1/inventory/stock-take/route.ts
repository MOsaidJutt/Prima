import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withTenantApi, apiOk, apiError } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'
import { createAuditLog } from '@/lib/audit'

const stockTakeSchema = z.object({
  warehouseId: z.string().uuid(),
  counts: z
    .array(
      z.object({
        productId: z.string().uuid(),
        countedQuantity: z.number().int().min(0),
        notes: z.string().optional(),
      })
    )
    .min(1),
})

export async function POST(req: NextRequest) {
  return withTenantApi(req, 'inventory:adjust', async ({ ctx, user }) => {
    const body = await req.json()
    const parsed = stockTakeSchema.safeParse(body)
    if (!parsed.success) return apiError(parsed.error.issues[0].message)

    const { warehouseId, counts } = parsed.data

    const warehouse = await prisma.warehouse.findFirst({
      where: { id: warehouseId, organizationId: ctx.organizationId, deletedAt: null },
    })
    if (!warehouse) return apiError('Warehouse not found', 404)

    const variances: Array<{
      productId: string
      expected: number
      counted: number
      variance: number
    }> = []

    await prisma.$transaction(async (tx) => {
      for (const count of counts) {
        // C-2: include organizationId in InventoryStock lookup
        const existing = await tx.inventoryStock.findFirst({
          where: { productId: count.productId, warehouseId, organizationId: ctx.organizationId },
        })
        const expected = existing?.quantity ?? 0
        const variance = count.countedQuantity - expected

        variances.push({
          productId: count.productId,
          expected,
          counted: count.countedQuantity,
          variance,
        })

        if (variance !== 0) {
          await tx.inventoryStock.upsert({
            where: { productId_warehouseId: { productId: count.productId, warehouseId } },
            create: {
              organizationId: ctx.organizationId,
              productId: count.productId,
              warehouseId,
              quantity: count.countedQuantity,
              lastModifiedBy: user.id,
            },
            update: { quantity: count.countedQuantity, lastModifiedBy: user.id },
          })
          await tx.inventoryTransaction.create({
            data: {
              organizationId: ctx.organizationId,
              productId: count.productId,
              toWarehouseId: variance > 0 ? warehouseId : undefined,
              fromWarehouseId: variance < 0 ? warehouseId : undefined,
              type: 'STOCK_TAKE',
              quantity: Math.abs(variance),
              reason: `Stock take variance: expected ${expected}, counted ${count.countedQuantity}`,
              notes: count.notes,
              referenceType: 'STOCK_TAKE',
              performedBy: user.id,
            },
          })
        }
      }
    })

    const adjustedCount = variances.filter((v) => v.variance !== 0).length

    // L-3: pass req
    await createAuditLog({
      organizationId: ctx.organizationId,
      userId: user.id,
      action: 'UPDATE',
      entity: 'StockTake',
      entityId: warehouseId,
      newValue: { warehouseId, totalProducts: counts.length, adjusted: adjustedCount },
      req,
    })

    return apiOk({ success: true, variances, totalProducts: counts.length, adjustedCount })
  })
}
