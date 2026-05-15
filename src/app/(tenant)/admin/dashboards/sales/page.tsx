import { redirect } from 'next/navigation'
import { requireTenantAuth } from '@/lib/auth/require-tenant-auth'
import { prisma } from '@/lib/prisma'
import { KPICard } from '@/components/widgets/kpi-card'
import { LineChartCard, BarChartCard, DonutChartCard } from '@/components/widgets/chart-cards'
import { Leaderboard } from '@/components/widgets/leaderboard'
import { DataTableWidget } from '@/components/widgets/data-table-widget'
import { FilterBar } from '@/components/widgets/filter-bar'
import { ExportButton } from '@/components/widgets/export-button'
import { Badge } from '@/components/ui/badge'
import { format, subMonths, startOfMonth, endOfDay, startOfDay } from 'date-fns'
import { DollarSign, ShoppingCart, Users, TrendingUp } from 'lucide-react'
import { cacheGet, cacheSet, dashboardKey } from '@/lib/dashboard-cache'

export const metadata = { title: 'Sales Dashboard' }
export const dynamic = 'force-dynamic'

async function getData(orgId: string, from: Date, to: Date, userId?: string) {
  const cacheKey = dashboardKey(
    orgId,
    'sales',
    `${from.toISOString().slice(0, 10)}_${to.toISOString().slice(0, 10)}_${userId ?? ''}`
  )
  const cached = await cacheGet(cacheKey)
  if (cached) return cached as Awaited<ReturnType<typeof fetchData>>

  const result = await fetchData(orgId, from, to, userId)
  await cacheSet(cacheKey, result)
  return result
}

async function fetchData(orgId: string, from: Date, to: Date, userId?: string) {
  const invoiceWhere = {
    organizationId: orgId,
    issueDate: { gte: from, lte: to },
    deletedAt: null,
    ...(userId ? { createdById: userId } : {}),
  }
  const dsrWhere = {
    organizationId: orgId,
    reportDate: { gte: from, lte: to },
    deletedAt: null,
    ...(userId ? { submittedById: userId } : {}),
  }

  const [
    totalRevenue,
    totalDSRs,
    approvedDSRs,
    newClients,
    visitTypeDist,
    revenueByRep,
    topClients,
    dailyRevenue,
  ] = await Promise.all([
    prisma.invoice.aggregate({ where: invoiceWhere, _sum: { grandTotal: true } }),
    prisma.dSREntry.count({ where: dsrWhere }),
    prisma.dSREntry.count({ where: { ...dsrWhere, status: 'APPROVED' } }),
    prisma.client.count({
      where: { organizationId: orgId, createdAt: { gte: from, lte: to }, deletedAt: null },
    }),
    prisma.dSREntry.groupBy({ by: ['visitType'], where: dsrWhere, _count: true }),
    prisma.invoice.groupBy({
      by: ['createdById'],
      where: { ...invoiceWhere, createdById: { not: null } },
      _sum: { grandTotal: true },
      orderBy: { _sum: { grandTotal: 'desc' } },
      take: 5,
    }),
    prisma.invoice.groupBy({
      by: ['clientId'],
      where: invoiceWhere,
      _sum: { grandTotal: true },
      orderBy: { _sum: { grandTotal: 'desc' } },
      take: 5,
    }),
    // Last 30 days daily
    Promise.all(
      Array.from({ length: 30 }).map(async (_, i) => {
        const d = new Date(to)
        d.setDate(d.getDate() - (29 - i))
        const agg = await prisma.invoice.aggregate({
          where: { ...invoiceWhere, issueDate: { gte: startOfDay(d), lte: endOfDay(d) } },
          _sum: { grandTotal: true },
        })
        return { name: format(d, 'dd MMM'), revenue: Number(agg._sum.grandTotal ?? 0) }
      })
    ),
  ])

  const repIds = revenueByRep.map((r) => r.createdById!).filter(Boolean)
  const repUsers = repIds.length
    ? await prisma.user.findMany({
        where: { id: { in: repIds } },
        select: { id: true, name: true, avatar: true },
      })
    : []
  const clientIds = topClients.map((c) => c.clientId)
  const clientRecords = clientIds.length
    ? await prisma.client.findMany({
        where: { id: { in: clientIds } },
        select: { id: true, companyName: true },
      })
    : []

  return {
    kpis: {
      totalRevenue: Number(totalRevenue._sum.grandTotal ?? 0),
      totalDSRs,
      approvedDSRs,
      conversionRate: totalDSRs > 0 ? (approvedDSRs / totalDSRs) * 100 : 0,
      newClients,
    },
    dailyRevenue,
    visitTypeDist: visitTypeDist.map((v) => ({ name: v.visitType, value: v._count })),
    revenueByRep: revenueByRep.map((r, i) => {
      const u = repUsers.find((u) => u.id === r.createdById)
      return {
        rank: i + 1,
        id: r.createdById ?? '',
        name: u?.name ?? 'Unknown',
        avatar: u?.avatar,
        value: Number(r._sum.grandTotal ?? 0),
      }
    }),
    topClients: topClients.map((c) => {
      const cl = clientRecords.find((r) => r.id === c.clientId)
      return { name: cl?.companyName ?? 'Unknown', value: Number(c._sum.grandTotal ?? 0) }
    }),
  }
}

export default async function SalesDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; user?: string; dept?: string }>
}) {
  const auth = await requireTenantAuth('dashboard:read')
  if (!auth.ok) redirect('/login')
  const orgId = auth.session.organizationId

  const sp = await searchParams
  const now = new Date()
  const from = sp.from ? new Date(sp.from) : startOfMonth(now)
  const to = sp.to ? new Date(sp.to) : endOfDay(now)

  const [data, users, departments] = await Promise.all([
    getData(orgId, from, to, sp.user),
    prisma.user.findMany({
      where: { organizationId: orgId, isActive: true, deletedAt: null },
      select: { id: true, name: true },
    }),
    prisma.department.findMany({
      where: { organizationId: orgId, deletedAt: null },
      select: { id: true, name: true },
    }),
  ])

  const exportData = data.topClients.map((c) => ({ Client: c.name, Revenue: c.value }))

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Sales Dashboard</h1>
          <p className="text-muted-foreground text-sm">
            Revenue, DSR performance, and client acquisition
          </p>
        </div>
        <ExportButton data={exportData} filename="Sales Dashboard" />
      </div>

      <FilterBar showDateRange showDepartment showUser departments={departments} users={users} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard
          label="Total Revenue"
          value={Math.round(data.kpis.totalRevenue).toLocaleString()}
          prefix="PKR "
          icon={DollarSign}
          iconColor="text-green-600"
        />
        <KPICard
          label="DSRs Submitted"
          value={data.kpis.totalDSRs}
          icon={ShoppingCart}
          iconColor="text-blue-600"
        />
        <KPICard
          label="Conversion Rate"
          value={`${data.kpis.conversionRate.toFixed(1)}%`}
          icon={TrendingUp}
          iconColor="text-accent"
        />
        <KPICard
          label="New Clients"
          value={data.kpis.newClients}
          icon={Users}
          iconColor="text-purple-600"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <LineChartCard
            title="Daily Revenue"
            description="Last 30 days"
            data={data.dailyRevenue}
            lines={[{ key: 'revenue', label: 'Revenue', color: '#0369A1' }]}
            yPrefix="PKR "
          />
        </div>
        <DonutChartCard
          title="Visits by Type"
          data={data.visitTypeDist.map((v, i) => ({
            name: v.name,
            value: v.value,
            color: ['#0369A1', '#22C55E', '#F59E0B', '#EF4444'][i % 4],
          }))}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Leaderboard title="Top Reps by Revenue" entries={data.revenueByRep} valuePrefix="PKR " />
        <DataTableWidget
          title="Top Clients"
          columns={[
            { key: 'name', label: 'Client' },
            {
              key: 'revenue',
              label: 'Revenue',
              render: (row) => (
                <span className="font-mono text-sm">
                  PKR {Number((row as { value: number }).value).toLocaleString()}
                </span>
              ),
            },
          ]}
          data={data.topClients.map((c) => ({ name: c.name, value: c.value }))}
        />
      </div>
    </div>
  )
}
