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

    // H-5: batch-fetch all existing stock in ONE query before the transaction,
    // so the transaction body contains only writes (no reads inside the tx).
    // This avoids holding row locks while waiting for sequential DB round-trips.
    const productIds = counts.map((c) => c.productId)
    const existingStocks = await prisma.inventoryStock.findMany({
      where: { productId: { in: productIds }, warehouseId, organizationId: ctx.organizationId },
      select: { productId: true, quantity: true },
    })
    const stockMap = Object.fromEntries(existingStocks.map((s) => [s.productId, s.quantity]))

    // Compute variances in memory (no DB access)
    const variances = counts.map((count) => ({
      productId: count.productId,
      notes: count.notes,
      expected: stockMap[count.productId] ?? 0,
      counted: count.countedQuantity,
      variance: count.countedQuantity - (stockMap[count.productId] ?? 0),
    }))

    const changed = variances.filter((v) => v.variance !== 0)

    if (changed.length > 0) {
      // All writes in one transaction — no reads inside, so the transaction is short and fast
      await prisma.$transaction([
        ...changed.map((v) =>
          prisma.inventoryStock.upsert({
            where: { productId_warehouseId: { productId: v.productId, warehouseId } },
            create: {
              organizationId: ctx.organizationId,
              productId: v.productId,
              warehouseId,
              quantity: v.counted,
              lastModifiedBy: user.id,
            },
            update: { quantity: v.counted, lastModifiedBy: user.id },
          })
        ),
        ...changed.map((v) =>
          prisma.inventoryTransaction.create({
            data: {
              organizationId: ctx.organizationId,
              productId: v.productId,
              toWarehouseId: v.variance > 0 ? warehouseId : undefined,
              fromWarehouseId: v.variance < 0 ? warehouseId : undefined,
              type: 'STOCK_TAKE',
              quantity: Math.abs(v.variance),
              reason: `Stock take variance: expected ${v.expected}, counted ${v.counted}`,
              notes: v.notes,
              referenceType: 'STOCK_TAKE',
              performedBy: user.id,
            },
          })
        ),
      ])
    }

    await createAuditLog({
      organizationId: ctx.organizationId,
      userId: user.id,
      action: 'UPDATE',
      entity: 'StockTake',
      entityId: warehouseId,
      newValue: { warehouseId, totalProducts: counts.length, adjusted: changed.length },
      req,
    })

    return apiOk({
      success: true,
      variances,
      totalProducts: counts.length,
      adjustedCount: changed.length,
    })
  })
}
