import { NextRequest } from 'next/server'
import { withTenantApi, apiOk } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  return withTenantApi(req, 'inventory:read', async ({ ctx }) => {
    const url = new URL(req.url)
    const page = Math.max(1, Number(url.searchParams.get('page') ?? 1))
    const pageSize = Math.min(100, Number(url.searchParams.get('pageSize') ?? 25))
    const productId = url.searchParams.get('productId') ?? ''
    const warehouseId = url.searchParams.get('warehouseId') ?? ''
    const type = url.searchParams.get('type') ?? ''
    const from = url.searchParams.get('from') ?? ''
    const to = url.searchParams.get('to') ?? ''

    const where = {
      organizationId: ctx.organizationId,
      ...(productId && { productId }),
      ...(warehouseId && {
        OR: [{ fromWarehouseId: warehouseId }, { toWarehouseId: warehouseId }],
      }),
      ...(type && {
        type: type as
          | 'PURCHASE'
          | 'SALE'
          | 'ADJUSTMENT_IN'
          | 'ADJUSTMENT_OUT'
          | 'TRANSFER_IN'
          | 'TRANSFER_OUT'
          | 'RETURN'
          | 'WRITE_OFF'
          | 'STOCK_TAKE',
      }),
      ...(from && { createdAt: { gte: new Date(from) } }),
      ...(to && { createdAt: { lte: new Date(to) } }),
    }

    const [transactions, total] = await Promise.all([
      prisma.inventoryTransaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          product: { select: { id: true, sku: true, name: true } },
          fromWarehouse: { select: { id: true, name: true } },
          toWarehouse: { select: { id: true, name: true } },
          performedByUser: { select: { id: true, name: true } },
        },
      }),
      prisma.inventoryTransaction.count({ where }),
    ])

    return apiOk({ transactions, total, page, pageSize })
  })
}
