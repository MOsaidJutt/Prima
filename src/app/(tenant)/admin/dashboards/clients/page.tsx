import { redirect } from 'next/navigation'
import { requireTenantAuth } from '@/lib/auth/require-tenant-auth'
import { prisma } from '@/lib/prisma'
import { KPICard } from '@/components/widgets/kpi-card'
import { BarChartCard, DonutChartCard } from '@/components/widgets/chart-cards'
import { DataTableWidget } from '@/components/widgets/data-table-widget'
import { MapWidget } from '@/components/widgets/map-widget'
import { FilterBar } from '@/components/widgets/filter-bar'
import { ExportButton } from '@/components/widgets/export-button'
import Link from 'next/link'
import { Users, UserPlus } from 'lucide-react'
import { startOfMonth, endOfDay, format } from 'date-fns'
import { cacheGet, cacheSet, dashboardKey } from '@/lib/dashboard-cache'

export const metadata = { title: 'Clients Dashboard' }
export const dynamic = 'force-dynamic'

const SCORE_COLORS: Record<string, string> = {
  EXCELLENT: 'text-green-600 bg-green-50',
  GOOD: 'text-blue-600 bg-blue-50',
  AVERAGE: 'text-yellow-600 bg-yellow-50',
  RISKY: 'text-orange-600 bg-orange-50',
  DEFAULTER: 'text-red-600 bg-red-50',
}

async function getData(orgId: string, from: Date, to: Date) {
  const cacheKey = dashboardKey(
    orgId,
    'clients',
    `${from.toISOString().slice(0, 10)}_${to.toISOString().slice(0, 10)}`
  )
  const cached = await cacheGet(cacheKey)
  if (cached) return cached as Awaited<ReturnType<typeof fetchData>>
  const result = await fetchData(orgId, from, to)
  await cacheSet(cacheKey, result)
  return result
}

async function fetchData(orgId: string, from: Date, to: Date) {
  const [
    total,
    active,
    inactive,
    prospect,
    churned,
    bizTypeDist,
    bizSizeDist,
    topByLTV,
    mapPoints,
    newThisPeriod,
  ] = await Promise.all([
    prisma.client.count({ where: { organizationId: orgId, deletedAt: null } }),
    prisma.client.count({ where: { organizationId: orgId, status: 'ACTIVE', deletedAt: null } }),
    prisma.client.count({ where: { organizationId: orgId, status: 'INACTIVE', deletedAt: null } }),
    prisma.client.count({ where: { organizationId: orgId, status: 'PROSPECT', deletedAt: null } }),
    prisma.client.count({ where: { organizationId: orgId, status: 'CHURNED', deletedAt: null } }),
    prisma.client.groupBy({
      by: ['businessType'],
      where: { organizationId: orgId, deletedAt: null, businessType: { not: null } },
      _count: true,
    }),
    prisma.client.groupBy({
      by: ['businessSize'],
      where: { organizationId: orgId, deletedAt: null, businessSize: { not: null } },
      _count: true,
    }),
    prisma.client.findMany({
      where: { organizationId: orgId, deletedAt: null },
      orderBy: { totalLifetimeValue: 'desc' },
      take: 10,
      select: {
        id: true,
        code: true,
        companyName: true,
        status: true,
        totalLifetimeValue: true,
        totalOrders: true,
        lastOrderDate: true,
        paymentBehaviorScore: true,
        paymentBehaviorLabel: true,
      },
    }),
    prisma.client.findMany({
      where: {
        organizationId: orgId,
        deletedAt: null,
        latitude: { not: null },
        longitude: { not: null },
      },
      select: { id: true, companyName: true, city: true, latitude: true, longitude: true },
      take: 200,
    }),
    prisma.client.count({
      where: { organizationId: orgId, createdAt: { gte: from, lte: to }, deletedAt: null },
    }),
  ])

  return {
    kpis: { total, active, inactive, prospect, churned, newThisPeriod },
    bizTypeDist: bizTypeDist.map((b) => ({ name: b.businessType!, value: b._count })),
    bizSizeDist: bizSizeDist.map((b) => ({ name: b.businessSize!, value: b._count })),
    topByLTV: topByLTV.map((c) => ({ ...c, ltv: Number(c.totalLifetimeValue) })),
    mapPoints: mapPoints.map((c) => ({
      lat: Number(c.latitude!),
      lng: Number(c.longitude!),
      label: c.companyName,
      value: c.city ?? '',
    })),
  }
}

type ClientRow = {
  id: string
  code: string
  companyName: string
  status: string
  ltv: number
  totalOrders: number
  lastOrderDate: Date | null
  paymentBehaviorScore: number | null
  paymentBehaviorLabel: string | null
}

export default async function ClientsDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>
}) {
  const auth = await requireTenantAuth('dashboard:read')
  if (!auth.ok) redirect('/login')
  const orgId = auth.session.organizationId

  const sp = await searchParams
  const now = new Date()
  const from = sp.from ? new Date(sp.from) : startOfMonth(now)
  const to = sp.to ? new Date(sp.to) : endOfDay(now)

  const data = await getData(orgId, from, to)
  const exportData = data.topByLTV.map((c: ClientRow) => ({
    Code: c.code,
    Name: c.companyName,
    Status: c.status,
    LTV: c.ltv,
    Orders: c.totalOrders,
  }))

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Client Overview</h1>
          <p className="text-muted-foreground text-sm">
            Client health, acquisition, and distribution
          </p>
        </div>
        <ExportButton data={exportData} filename="Clients Dashboard" />
      </div>

      <FilterBar showDateRange />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard
          label="Total Clients"
          value={data.kpis.total}
          icon={Users}
          iconColor="text-blue-600"
        />
        <KPICard label="Active" value={data.kpis.active} icon={Users} iconColor="text-green-600" />
        <KPICard
          label="Prospects"
          value={data.kpis.prospect}
          icon={Users}
          iconColor="text-yellow-600"
        />
        <KPICard
          label="New This Period"
          value={data.kpis.newThisPeriod}
          icon={UserPlus}
          iconColor="text-accent"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <DonutChartCard
          title="By Business Type"
          data={data.bizTypeDist.map((b, i) => ({
            name: b.name,
            value: b.value,
            color: ['#0369A1', '#22C55E', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4'][i % 6],
          }))}
        />
        <div className="lg:col-span-2">
          <BarChartCard
            title="Business Size Distribution"
            data={data.bizSizeDist}
            bars={[{ key: 'value', label: 'Clients', color: '#0369A1' }]}
          />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <DataTableWidget
          title="Top Clients by Lifetime Value"
          columns={[
            {
              key: 'code',
              label: 'Code',
              render: (r: ClientRow) => <span className="font-mono text-xs">{r.code}</span>,
            },
            {
              key: 'name',
              label: 'Name',
              render: (r: ClientRow) => (
                <Link href={`/admin/clients/${r.id}`} className="font-medium hover:underline">
                  {r.companyName}
                </Link>
              ),
            },
            {
              key: 'ltv',
              label: 'LTV',
              render: (r: ClientRow) => (
                <span className="font-mono text-sm">PKR {r.ltv.toLocaleString()}</span>
              ),
            },
            { key: 'orders', label: 'Orders', render: (r: ClientRow) => r.totalOrders },
            {
              key: 'score',
              label: 'Pay Score',
              render: (r: ClientRow) =>
                r.paymentBehaviorLabel ? (
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${SCORE_COLORS[r.paymentBehaviorLabel] ?? ''}`}
                  >
                    {r.paymentBehaviorLabel}
                  </span>
                ) : (
                  <span className="text-muted-foreground text-xs">—</span>
                ),
            },
          ]}
          data={data.topByLTV as ClientRow[]}
        />
        <MapWidget title="Client Locations" points={data.mapPoints} height={320} />
      </div>
    </div>
  )
}
