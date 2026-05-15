import { withTenantApi } from '@/lib/api-helpers'
import { prisma, Prisma } from '@/lib/prisma'
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

    // M-4: SQL aggregate for low-stock — scales to any catalog size without loading rows
    const lowStockRaw = await prisma.$queryRaw<
      { id: string; sku: string; name: string; reorderLevel: number; quantity: string }[]
    >(
      categoryId
        ? Prisma.sql`
            SELECT p.id, p.sku, p.name, p."reorderLevel",
                   COALESCE(SUM(s.quantity), 0)::text AS quantity
            FROM "Product" p
            LEFT JOIN "InventoryStock" s ON s."productId" = p.id
            WHERE p."organizationId" = ${orgId}::uuid
              AND p."deletedAt" IS NULL
              AND p.status = 'ACTIVE'
              AND p."categoryId" = ${categoryId}::uuid
            GROUP BY p.id, p.sku, p.name, p."reorderLevel"
            HAVING COALESCE(SUM(s.quantity), 0) <= p."reorderLevel"
            ORDER BY COALESCE(SUM(s.quantity), 0) ASC
            LIMIT 10`
        : Prisma.sql`
            SELECT p.id, p.sku, p.name, p."reorderLevel",
                   COALESCE(SUM(s.quantity), 0)::text AS quantity
            FROM "Product" p
            LEFT JOIN "InventoryStock" s ON s."productId" = p.id
            WHERE p."organizationId" = ${orgId}::uuid
              AND p."deletedAt" IS NULL
              AND p.status = 'ACTIVE'
            GROUP BY p.id, p.sku, p.name, p."reorderLevel"
            HAVING COALESCE(SUM(s.quantity), 0) <= p."reorderLevel"
            ORDER BY COALESCE(SUM(s.quantity), 0) ASC
            LIMIT 10`
    )
    const lowStockList = lowStockRaw.map((r) => ({ ...r, quantity: Number(r.quantity) }))

    // Stock by category — single join query instead of N+1 per-category aggregates
    const stockByCatRaw = await prisma.$queryRaw<{ name: string; value: string }[]>(
      Prisma.sql`
        SELECT c.name, COALESCE(SUM(s.quantity), 0)::text AS value
        FROM "ProductCategory" c
        LEFT JOIN "Product" p ON p."categoryId" = c.id AND p."deletedAt" IS NULL AND p.status = 'ACTIVE'
        LEFT JOIN "InventoryStock" s ON s."productId" = p.id
        WHERE c."organizationId" = ${orgId}::uuid AND c."deletedAt" IS NULL
        GROUP BY c.id, c.name
        ORDER BY c.name
      `
    )
    const stockByCat = stockByCatRaw.map((r) => ({ name: r.name, value: Number(r.value) }))

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
