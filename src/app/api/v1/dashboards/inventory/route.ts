import { withTenantApi } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'
import { cacheGet, cacheSet, dashboardKey } from '@/lib/dashboard-cache'

export async function GET(req: Request) {
  return withTenantApi(req, 'dashboard:read', async ({ ctx }) => {
    const orgId = ctx.organizationId
    const url = new URL(req.url)
    const categoryId = url.searchParams.get('category') || undefined

    const cacheKey = dashboardKey(orgId, 'inventory', categoryId ?? '')
    const cached = await cacheGet(cacheKey)
    if (cached)
      return new Response(JSON.stringify(cached), {
        headers: { 'Content-Type': 'application/json' },
      }) as never

    const where = {
      organizationId: orgId,
      deletedAt: null,
      status: 'ACTIVE' as const,
      ...(categoryId ? { categoryId } : {}),
    }

    const [totalProducts, totalStock, outOfStock, recentTransactions, warehouseUtil] =
      await Promise.all([
        prisma.product.count({ where }),
        prisma.inventoryStock.aggregate({
          where: { organizationId: orgId, product: { deletedAt: null } },
          _sum: { quantity: true },
        }),
        prisma.product.count({
          where: { ...where, inventoryStock: { every: { quantity: { lte: 0 } } } },
        }),
        prisma.inventoryTransaction.findMany({
          where: { organizationId: orgId },
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true,
            type: true,
            quantity: true,
            createdAt: true,
            reason: true,
            product: { select: { id: true, name: true, sku: true } },
            fromWarehouse: { select: { name: true } },
            toWarehouse: { select: { name: true } },
          },
        }),
        prisma.warehouse.findMany({
          where: { organizationId: orgId, isActive: true, deletedAt: null },
          select: {
            id: true,
            name: true,
            _count: { select: { inventoryStock: true } },
          },
        }),
      ])

    // Low stock: products at or below their reorder level
    const allProducts = await prisma.product.findMany({
      where,
      include: { inventoryStock: { select: { quantity: true } } },
      take: 100,
    })
    const lowStockList = allProducts
      .map((p) => {
        const total = p.inventoryStock.reduce((s, i) => s + i.quantity, 0)
        return { id: p.id, sku: p.sku, name: p.name, quantity: total, reorderLevel: p.reorderLevel }
      })
      .filter((p) => p.quantity <= p.reorderLevel)
      .sort((a, b) => a.quantity - b.quantity)
      .slice(0, 10)

    // Stock by category
    const categories = await prisma.productCategory.findMany({
      where: { organizationId: orgId, deletedAt: null },
      select: { id: true, name: true },
    })

    const stockByCat = await Promise.all(
      categories.map(async (cat) => {
        const agg = await prisma.inventoryStock.aggregate({
          where: { organizationId: orgId, product: { categoryId: cat.id, deletedAt: null } },
          _sum: { quantity: true },
        })
        return { name: cat.name, value: Number(agg._sum.quantity ?? 0) }
      })
    )

    const data = {
      kpis: {
        totalProducts,
        totalStock: Number(totalStock._sum.quantity ?? 0),
        lowStock: lowStockList.length,
        outOfStock,
        warehouseCount: warehouseUtil.length,
      },
      stockByCategory: stockByCat.filter((c) => c.value > 0),
      lowStockList,
      recentTransactions,
    }

    await cacheSet(cacheKey, data)
    return new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json' },
    }) as never
  })
}
