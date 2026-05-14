import { NextRequest } from 'next/server'
import { withTenantApi, apiOk } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  return withTenantApi(req, 'inventory:read', async ({ ctx }) => {
    const url = new URL(req.url)
    const warehouseId = url.searchParams.get('warehouseId') ?? ''
    const categoryId = url.searchParams.get('categoryId') ?? ''
    const lowStock = url.searchParams.get('lowStock') === 'true'
    // M-3: paginate — large orgs with many SKUs cannot return all rows at once
    const page = Math.max(1, Number(url.searchParams.get('page') ?? 1))
    const pageSize = Math.min(100, Number(url.searchParams.get('pageSize') ?? 50))
    const search = url.searchParams.get('search') ?? ''

    const where = {
      organizationId: ctx.organizationId,
      deletedAt: null as null,
      status: 'ACTIVE' as const,
      ...(categoryId && { categoryId }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { sku: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        select: {
          id: true,
          sku: true,
          name: true,
          brand: true,
          reorderLevel: true,
          status: true,
          category: { select: { name: true } },
          inventoryStock: {
            where: warehouseId ? { warehouseId } : undefined,
            include: { warehouse: { select: { id: true, name: true, code: true } } },
          },
        },
        orderBy: { name: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.product.count({ where }),
    ])

    const result = products
      .map((p) => {
        const totalQty = p.inventoryStock.reduce((s, i) => s + i.quantity, 0)
        return { ...p, totalStock: totalQty, isLowStock: totalQty <= p.reorderLevel }
      })
      .filter((p) => !lowStock || p.isLowStock)

    const warehouses = await prisma.warehouse.findMany({
      where: { organizationId: ctx.organizationId, deletedAt: null, isActive: true },
      select: { id: true, code: true, name: true },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    })

    return apiOk({ stock: result, warehouses, total, page, pageSize })
  })
}
