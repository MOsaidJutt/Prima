import { redirect } from 'next/navigation'
import { requireTenantAuth } from '@/lib/auth/require-tenant-auth'
import { prisma } from '@/lib/prisma'
import { KPICard } from '@/components/widgets/kpi-card'
import { BarChartCard, DonutChartCard } from '@/components/widgets/chart-cards'
import { DataTableWidget } from '@/components/widgets/data-table-widget'
import { AIInsightsCard } from '@/components/widgets/ai-insights-card'
import { FilterBar } from '@/components/widgets/filter-bar'
import { ExportButton } from '@/components/widgets/export-button'
import { Package, AlertTriangle, Warehouse } from 'lucide-react'
import { cacheGet, cacheSet, dashboardKey } from '@/lib/dashboard-cache'
import { format } from 'date-fns'
import Link from 'next/link'

export const metadata = { title: 'Inventory Dashboard' }
export const dynamic = 'force-dynamic'

async function getData(orgId: string, categoryId?: string) {
  const cacheKey = dashboardKey(orgId, 'inventory', categoryId ?? '')
  const cached = await cacheGet(cacheKey)
  if (cached) return cached as Awaited<ReturnType<typeof fetchData>>
  const result = await fetchData(orgId, categoryId)
  await cacheSet(cacheKey, result)
  return result
}

async function fetchData(orgId: string, categoryId?: string) {
  const productWhere = {
    organizationId: orgId,
    deletedAt: null,
    status: 'ACTIVE' as const,
    ...(categoryId ? { categoryId } : {}),
  }

  const [totalProducts, totalStock, recentTx, categories, warehouses] = await Promise.all([
    prisma.product.count({ where: productWhere }),
    prisma.inventoryStock.aggregate({
      where: { organizationId: orgId, product: { deletedAt: null } },
      _sum: { quantity: true },
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
        product: { select: { name: true, sku: true } },
        fromWarehouse: { select: { name: true } },
        toWarehouse: { select: { name: true } },
      },
    }),
    prisma.productCategory.findMany({
      where: { organizationId: orgId, deletedAt: null },
      select: { id: true, name: true },
    }),
    prisma.warehouse.findMany({
      where: { organizationId: orgId, isActive: true, deletedAt: null },
      select: { id: true, name: true, _count: { select: { inventoryStock: true } } },
    }),
  ])

  // Stock by category
  const stockByCat = await Promise.all(
    categories.map(async (cat) => {
      const agg = await prisma.inventoryStock.aggregate({
        where: { organizationId: orgId, product: { categoryId: cat.id, deletedAt: null } },
        _sum: { quantity: true },
      })
      return { name: cat.name, value: Number(agg._sum.quantity ?? 0) }
    })
  )

  // Low stock products
  const products = await prisma.product.findMany({
    where: productWhere,
    include: { inventoryStock: { select: { quantity: true } } },
    take: 100,
  })
  const lowStockList = products
    .map((p) => ({
      id: p.id,
      sku: p.sku,
      name: p.name,
      quantity: p.inventoryStock.reduce((s, i) => s + i.quantity, 0),
      reorderLevel: p.reorderLevel,
    }))
    .filter((p) => p.quantity <= p.reorderLevel)
    .sort((a, b) => a.quantity - b.quantity)
    .slice(0, 10)

  const outOfStock = lowStockList.filter((p) => p.quantity <= 0).length

  return {
    kpis: {
      totalProducts,
      totalStock: Number(totalStock._sum.quantity ?? 0),
      lowStock: lowStockList.length,
      outOfStock,
      warehouseCount: warehouses.length,
    },
    stockByCat: stockByCat.filter((c) => c.value > 0),
    lowStockList,
    recentTx,
    categories,
  }
}

type LowStockRow = { id: string; sku: string; name: string; quantity: number; reorderLevel: number }
type TxRow = {
  id: string
  type: string
  quantity: number
  createdAt: Date
  reason: string | null
  product: { name: string; sku: string }
  fromWarehouse: { name: string } | null
  toWarehouse: { name: string } | null
}

export default async function InventoryDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>
}) {
  const auth = await requireTenantAuth('dashboard:read')
  if (!auth.ok) redirect('/login')
  const orgId = auth.session.organizationId

  const sp = await searchParams
  const data = await getData(orgId, sp.category)
  const exportData = data.lowStockList.map((p: LowStockRow) => ({
    SKU: p.sku,
    Name: p.name,
    Quantity: p.quantity,
    ReorderLevel: p.reorderLevel,
  }))

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Inventory Dashboard</h1>
          <p className="text-muted-foreground text-sm">Stock levels, movements, and alerts</p>
        </div>
        <ExportButton data={exportData} filename="Inventory Dashboard" />
      </div>

      <FilterBar showCategory categories={data.categories} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard
          label="Active Products"
          value={data.kpis.totalProducts}
          icon={Package}
          iconColor="text-blue-600"
        />
        <KPICard
          label="Total Stock Units"
          value={data.kpis.totalStock.toLocaleString()}
          icon={Warehouse}
          iconColor="text-green-600"
        />
        <KPICard
          label="Low Stock Alerts"
          value={data.kpis.lowStock}
          icon={AlertTriangle}
          iconColor="text-yellow-600"
        />
        <KPICard
          label="Out of Stock"
          value={data.kpis.outOfStock}
          icon={AlertTriangle}
          iconColor="text-red-600"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <BarChartCard
            title="Stock by Category"
            data={data.stockByCat}
            bars={[{ key: 'value', label: 'Units', color: '#0369A1' }]}
          />
        </div>
        <AIInsightsCard />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <DataTableWidget
          title="Low Stock Alerts"
          description="Products at or below reorder level"
          emptyMessage="All stock levels are healthy"
          columns={[
            {
              key: 'sku',
              label: 'SKU',
              render: (r: LowStockRow) => <span className="font-mono text-xs">{r.sku}</span>,
            },
            {
              key: 'name',
              label: 'Product',
              render: (r: LowStockRow) => (
                <Link href={`/admin/products/${r.id}`} className="font-medium hover:underline">
                  {r.name}
                </Link>
              ),
            },
            {
              key: 'quantity',
              label: 'Qty',
              render: (r: LowStockRow) => (
                <span
                  className={`font-mono text-sm font-semibold ${r.quantity <= 0 ? 'text-red-600' : 'text-yellow-600'}`}
                >
                  {r.quantity}
                </span>
              ),
            },
            {
              key: 'reorderLevel',
              label: 'Reorder At',
              render: (r: LowStockRow) => (
                <span className="text-muted-foreground font-mono text-xs">{r.reorderLevel}</span>
              ),
            },
          ]}
          data={data.lowStockList as LowStockRow[]}
        />
        <DataTableWidget
          title="Recent Transactions"
          columns={[
            { key: 'product', label: 'Product', render: (r: TxRow) => r.product.name },
            {
              key: 'type',
              label: 'Type',
              render: (r: TxRow) => <span className="font-mono text-xs">{r.type}</span>,
            },
            {
              key: 'quantity',
              label: 'Qty',
              render: (r: TxRow) => (
                <span
                  className={`font-mono text-sm font-semibold ${r.type.includes('OUT') || r.type === 'SALE' ? 'text-red-600' : 'text-green-600'}`}
                >
                  {r.type.includes('OUT') || r.type === 'SALE' ? '-' : '+'}
                  {r.quantity}
                </span>
              ),
            },
            {
              key: 'date',
              label: 'Date',
              render: (r: TxRow) => (
                <span className="font-mono text-xs">
                  {format(new Date(r.createdAt), 'dd MMM HH:mm')}
                </span>
              ),
            },
          ]}
          data={data.recentTx as TxRow[]}
        />
      </div>
    </div>
  )
}
