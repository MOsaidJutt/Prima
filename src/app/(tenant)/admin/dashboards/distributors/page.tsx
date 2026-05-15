import { redirect } from 'next/navigation'
import { requireTenantAuth } from '@/lib/auth/require-tenant-auth'
import { prisma } from '@/lib/prisma'
import { KPICard } from '@/components/widgets/kpi-card'
import { BarChartCard, DonutChartCard } from '@/components/widgets/chart-cards'
import { DataTableWidget } from '@/components/widgets/data-table-widget'
import { MapWidget } from '@/components/widgets/map-widget'
import { FilterBar } from '@/components/widgets/filter-bar'
import { ExportButton } from '@/components/widgets/export-button'
import { Badge } from '@/components/ui/badge'
import { Truck, Star } from 'lucide-react'
import Link from 'next/link'
import { cacheGet, cacheSet, dashboardKey } from '@/lib/dashboard-cache'
import { startOfMonth, endOfDay } from 'date-fns'

export const metadata = { title: 'Distributors Dashboard' }
export const dynamic = 'force-dynamic'

const TIER_COLORS: Record<string, string> = {
  GOLD: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  SILVER: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400',
  BRONZE: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
}

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-800',
  INACTIVE: 'bg-gray-100 text-gray-700',
  BLACKLISTED: 'bg-red-100 text-red-800',
}

async function getData(orgId: string) {
  const cacheKey = dashboardKey(orgId, 'distributors')
  const cached = await cacheGet(cacheKey)
  if (cached) return cached as Awaited<ReturnType<typeof fetchData>>
  const result = await fetchData(orgId)
  await cacheSet(cacheKey, result)
  return result
}

async function fetchData(orgId: string) {
  const [total, active, inactive, blacklisted, tierDist, topDist, mapPoints] = await Promise.all([
    prisma.distributor.count({ where: { organizationId: orgId, deletedAt: null } }),
    prisma.distributor.count({
      where: { organizationId: orgId, status: 'ACTIVE', deletedAt: null },
    }),
    prisma.distributor.count({
      where: { organizationId: orgId, status: 'INACTIVE', deletedAt: null },
    }),
    prisma.distributor.count({
      where: { organizationId: orgId, status: 'BLACKLISTED', deletedAt: null },
    }),
    prisma.distributor.groupBy({
      by: ['tier'],
      where: { organizationId: orgId, deletedAt: null },
      _count: true,
    }),
    prisma.distributor.findMany({
      where: { organizationId: orgId, deletedAt: null },
      orderBy: { totalPurchases: 'desc' },
      take: 10,
      select: {
        id: true,
        code: true,
        companyName: true,
        city: true,
        status: true,
        tier: true,
        totalPurchases: true,
        currentBalance: true,
        rating: true,
      },
    }),
    prisma.distributor.findMany({
      where: {
        organizationId: orgId,
        deletedAt: null,
        latitude: { not: null },
        longitude: { not: null },
      },
      select: { id: true, companyName: true, city: true, latitude: true, longitude: true },
      take: 200,
    }),
  ])
  return {
    kpis: { total, active, inactive, blacklisted },
    tierDist: tierDist.map((t) => ({ name: t.tier, value: t._count })),
    topDist: topDist.map((d) => ({
      ...d,
      totalPurchases: Number(d.totalPurchases),
      balance: Number(d.currentBalance),
      rating: Number(d.rating),
    })),
    mapPoints: mapPoints.map((d) => ({
      lat: Number(d.latitude!),
      lng: Number(d.longitude!),
      label: d.companyName,
      value: d.city ?? '',
    })),
  }
}

type DistRow = {
  id: string
  code: string
  companyName: string
  city: string | null
  status: string
  tier: string
  totalPurchases: number
  balance: number
  rating: number
}

export default async function DistributorsDashboardPage() {
  const auth = await requireTenantAuth('dashboard:read')
  if (!auth.ok) redirect('/login')
  const orgId = auth.session.organizationId
  const data = await getData(orgId)

  const exportData = data.topDist.map((d: DistRow) => ({
    Code: d.code,
    Name: d.companyName,
    City: d.city,
    Status: d.status,
    Tier: d.tier,
    TotalPurchases: d.totalPurchases,
    Balance: d.balance,
  }))

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Distributor Overview</h1>
          <p className="text-muted-foreground text-sm">Performance across all distributors</p>
        </div>
        <ExportButton data={exportData} filename="Distributors Dashboard" />
      </div>

      <FilterBar showDateRange />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard
          label="Total Distributors"
          value={data.kpis.total}
          icon={Truck}
          iconColor="text-blue-600"
        />
        <KPICard label="Active" value={data.kpis.active} icon={Truck} iconColor="text-green-600" />
        <KPICard
          label="Inactive"
          value={data.kpis.inactive}
          icon={Truck}
          iconColor="text-yellow-600"
        />
        <KPICard
          label="Blacklisted"
          value={data.kpis.blacklisted}
          icon={Truck}
          iconColor="text-red-600"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <DonutChartCard
          title="By Tier"
          data={data.tierDist.map((t, i) => ({
            name: t.name,
            value: t.value,
            color: ['#F59E0B', '#94A3B8', '#B45309'][i % 3],
          }))}
        />
        <div className="lg:col-span-2">
          <BarChartCard
            title="Top Distributors by Volume"
            data={data.topDist
              .slice(0, 8)
              .map((d: DistRow) => ({
                name: d.companyName.slice(0, 15),
                volume: d.totalPurchases,
              }))}
            bars={[{ key: 'volume', label: 'Total Purchases', color: '#0369A1' }]}
            yPrefix="PKR "
          />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <DataTableWidget
          title="Distributor List"
          columns={[
            {
              key: 'code',
              label: 'Code',
              render: (r: DistRow) => <span className="font-mono text-xs">{r.code}</span>,
            },
            {
              key: 'name',
              label: 'Name',
              render: (r: DistRow) => (
                <Link href={`/admin/distributors/${r.id}`} className="font-medium hover:underline">
                  {r.companyName}
                </Link>
              ),
            },
            {
              key: 'tier',
              label: 'Tier',
              render: (r: DistRow) => (
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${TIER_COLORS[r.tier] ?? ''}`}
                >
                  {r.tier}
                </span>
              ),
            },
            {
              key: 'status',
              label: 'Status',
              render: (r: DistRow) => (
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[r.status] ?? ''}`}
                >
                  {r.status}
                </span>
              ),
            },
            {
              key: 'totalPurchases',
              label: 'Purchases',
              render: (r: DistRow) => (
                <span className="font-mono text-sm">PKR {r.totalPurchases.toLocaleString()}</span>
              ),
            },
          ]}
          data={data.topDist as DistRow[]}
        />
        <MapWidget title="Distributor Locations" points={data.mapPoints} height={320} />
      </div>
    </div>
  )
}
