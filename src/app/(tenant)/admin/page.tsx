import { redirect } from 'next/navigation'
import { requireTenantAuth } from '@/lib/auth/require-tenant-auth'
import { prisma } from '@/lib/prisma'
import { KPICard } from '@/components/widgets/kpi-card'
import { LineChartCard, DonutChartCard, AreaChartCard } from '@/components/widgets/chart-cards'
import { Leaderboard } from '@/components/widgets/leaderboard'
import { DataTableWidget } from '@/components/widgets/data-table-widget'
import { GaugeWidget } from '@/components/widgets/gauge-widget'
import { AIInsightsCard } from '@/components/widgets/ai-insights-card'
import { FilterBar } from '@/components/widgets/filter-bar'
import { ExportButton } from '@/components/widgets/export-button'
import { DashboardGrid } from '@/components/widgets/dashboard-grid'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { format, subMonths, startOfMonth, endOfMonth, startOfDay, endOfDay } from 'date-fns'
import { DollarSign, Users, FileText, CreditCard, TrendingUp, BarChart3 } from 'lucide-react'

export const metadata = { title: 'Executive Dashboard' }
export const dynamic = 'force-dynamic'

const STATUS_BADGE: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  SUBMITTED: 'bg-blue-100 text-blue-700',
  APPROVED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
}

async function getData(orgId: string, from: Date, to: Date) {
  const now = new Date()
  const lastFrom = subMonths(from, 1)
  const lastTo = subMonths(to, 1)

  const [
    totalRev,
    lastRev,
    activeClients,
    newClients,
    pendingDSRs,
    outstanding,
    collected,
    teamSize,
    invoiceStatusDist,
    recentDSRs,
    topTargets,
  ] = await Promise.all([
    prisma.invoice.aggregate({
      where: { organizationId: orgId, issueDate: { gte: from, lte: to }, deletedAt: null },
      _sum: { grandTotal: true },
    }),
    prisma.invoice.aggregate({
      where: { organizationId: orgId, issueDate: { gte: lastFrom, lte: lastTo }, deletedAt: null },
      _sum: { grandTotal: true },
    }),
    prisma.client.count({ where: { organizationId: orgId, status: 'ACTIVE', deletedAt: null } }),
    prisma.client.count({
      where: { organizationId: orgId, createdAt: { gte: from, lte: to }, deletedAt: null },
    }),
    prisma.dSREntry.count({
      where: { organizationId: orgId, status: 'SUBMITTED', deletedAt: null },
    }),
    prisma.invoice.aggregate({
      where: {
        organizationId: orgId,
        status: { in: ['ISSUED', 'PARTIALLY_PAID', 'OVERDUE'] },
        deletedAt: null,
      },
      _sum: { grandTotal: true, paidAmount: true },
    }),
    prisma.payment.aggregate({
      where: { organizationId: orgId, paymentDate: { gte: from, lte: to }, deletedAt: null },
      _sum: { amount: true },
    }),
    prisma.user.count({ where: { organizationId: orgId, isActive: true, deletedAt: null } }),
    prisma.invoice.groupBy({
      by: ['status'],
      where: { organizationId: orgId, deletedAt: null },
      _count: true,
    }),
    prisma.dSREntry.findMany({
      where: { organizationId: orgId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 8,
      select: {
        id: true,
        status: true,
        grandTotal: true,
        reportDate: true,
        submittedBy: { select: { name: true } },
        client: { select: { companyName: true } },
      },
    }),
    prisma.salesTarget.findMany({
      where: { organizationId: orgId, scope: 'ORGANIZATION', isActive: true, deletedAt: null },
      take: 2,
      select: { name: true, targetValue: true, achievedValue: true, type: true },
    }),
  ])

  // Revenue trend (6 months)
  const revenueTrend = await Promise.all(
    Array.from({ length: 6 }).map(async (_, i) => {
      const d = subMonths(now, 5 - i)
      const agg = await prisma.invoice.aggregate({
        where: {
          organizationId: orgId,
          issueDate: { gte: startOfMonth(d), lte: endOfMonth(d) },
          deletedAt: null,
        },
        _sum: { grandTotal: true },
      })
      return { name: format(d, 'MMM yy'), revenue: Number(agg._sum.grandTotal ?? 0) }
    })
  )

  // Top reps
  const topRepRaw = await prisma.invoice.groupBy({
    by: ['createdById'],
    where: {
      organizationId: orgId,
      issueDate: { gte: from, lte: to },
      deletedAt: null,
      createdById: { not: null },
    },
    _sum: { grandTotal: true },
    orderBy: { _sum: { grandTotal: 'desc' } },
    take: 5,
  })
  const repIds = topRepRaw.map((r) => r.createdById!).filter(Boolean)
  const repUsers = repIds.length
    ? await prisma.user.findMany({
        where: { id: { in: repIds } },
        select: { id: true, name: true, avatar: true },
      })
    : []

  const thisRev = Number(totalRev._sum.grandTotal ?? 0)
  const lastRev2 = Number(lastRev._sum.grandTotal ?? 0)
  const outstandingAmt =
    Number(outstanding._sum.grandTotal ?? 0) - Number(outstanding._sum.paidAmount ?? 0)

  return {
    kpis: {
      revenue: thisRev,
      revenueTrend: lastRev2 > 0 ? ((thisRev - lastRev2) / lastRev2) * 100 : 0,
      activeClients,
      newClients,
      pendingDSRs,
      outstanding: Math.max(outstandingAmt, 0),
      collected: Number(collected._sum.amount ?? 0),
      teamSize,
    },
    revenueTrend,
    invoiceStatusDist: invoiceStatusDist.map((s) => ({ name: s.status, value: s._count })),
    topReps: topRepRaw.map((r, i) => {
      const u = repUsers.find((u) => u.id === r.createdById)
      return {
        rank: i + 1,
        id: r.createdById ?? '',
        name: u?.name ?? 'Unknown',
        avatar: u?.avatar,
        value: Number(r._sum.grandTotal ?? 0),
      }
    }),
    recentDSRs: recentDSRs.map((d) => ({ ...d, grandTotal: Number(d.grandTotal) })),
    targets: topTargets.map((t) => ({
      name: t.name,
      target: Number(t.targetValue),
      achieved: Number(t.achievedValue),
    })),
  }
}

async function getFilters(orgId: string) {
  const [departments, users] = await Promise.all([
    prisma.department.findMany({
      where: { organizationId: orgId, deletedAt: null },
      select: { id: true, name: true },
    }),
    prisma.user.findMany({
      where: { organizationId: orgId, isActive: true, deletedAt: null },
      select: { id: true, name: true },
    }),
  ])
  return { departments, users }
}

type DSRRow = {
  id: string
  status: string
  grandTotal: number
  reportDate: Date
  submittedBy: { name: string }
  client: { companyName: string }
}

export default async function AdminDashboardPage({
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

  const [data, filters] = await Promise.all([getData(orgId, from, to), getFilters(orgId)])

  const exportData = data.recentDSRs.map((d: DSRRow) => ({
    Date: format(new Date(d.reportDate), 'dd MMM yyyy'),
    Rep: d.submittedBy.name,
    Client: d.client.companyName,
    Status: d.status,
    Total: d.grandTotal,
  }))

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Executive Dashboard</h1>
          <p className="text-muted-foreground mt-0.5 text-sm">Organization-wide overview</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportButton data={exportData} filename="Executive Dashboard" />
        </div>
      </div>

      <FilterBar
        showDateRange
        showDepartment
        showUser
        departments={filters.departments}
        users={filters.users}
      />

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard
          label="Revenue"
          value={`${data.kpis.revenue.toLocaleString()}`}
          prefix="PKR "
          trend={data.kpis.revenueTrend}
          trendLabel="vs last period"
          icon={DollarSign}
          iconColor="text-green-600"
        />
        <KPICard
          label="Active Clients"
          value={data.kpis.activeClients}
          icon={Users}
          iconColor="text-blue-600"
        />
        <KPICard
          label="Pending DSRs"
          value={data.kpis.pendingDSRs}
          icon={FileText}
          iconColor="text-yellow-600"
        />
        <KPICard
          label="Outstanding"
          value={`${Math.round(data.kpis.outstanding).toLocaleString()}`}
          prefix="PKR "
          icon={CreditCard}
          iconColor="text-red-600"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard
          label="Collected"
          value={`${Math.round(data.kpis.collected).toLocaleString()}`}
          prefix="PKR "
          icon={TrendingUp}
          iconColor="text-green-600"
        />
        <KPICard
          label="Team Size"
          value={data.kpis.teamSize}
          icon={Users}
          iconColor="text-accent"
        />
        <KPICard
          label="New Clients"
          value={data.kpis.newClients}
          icon={Users}
          iconColor="text-purple-600"
        />
        <KPICard label="Quick Links" value="" icon={BarChart3} iconColor="text-accent" />
      </div>

      {/* Charts row 1 */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <AreaChartCard
            title="Revenue Trend"
            description="Monthly revenue (last 6 months)"
            data={data.revenueTrend}
            areas={[{ key: 'revenue', label: 'Revenue', color: '#0369A1' }]}
            yPrefix="PKR "
          />
        </div>
        <DonutChartCard
          title="Invoice Status"
          data={data.invoiceStatusDist.map((s, i) => ({
            name: s.name,
            value: s.value,
            color: ['#22C55E', '#0369A1', '#F59E0B', '#EF4444', '#EF4444', '#94A3B8'][i % 6],
          }))}
        />
      </div>

      {/* Charts row 2 */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Leaderboard
          title="Top Sales Reps"
          description="By revenue this period"
          entries={data.topReps}
          valuePrefix="PKR "
        />
        <div className="lg:col-span-2">
          <DataTableWidget
            title="Recent DSRs"
            action={
              <Button asChild variant="ghost" size="sm">
                <Link href="/admin/dashboards/epr">View EPR →</Link>
              </Button>
            }
            columns={[
              { key: 'rep', label: 'Rep', render: (row: DSRRow) => row.submittedBy.name },
              { key: 'client', label: 'Client', render: (row: DSRRow) => row.client.companyName },
              {
                key: 'date',
                label: 'Date',
                render: (row: DSRRow) => (
                  <span className="font-mono text-xs">
                    {format(new Date(row.reportDate), 'dd MMM')}
                  </span>
                ),
              },
              {
                key: 'status',
                label: 'Status',
                render: (row: DSRRow) => (
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[row.status] ?? ''}`}
                  >
                    {row.status}
                  </span>
                ),
              },
              {
                key: 'total',
                label: 'Total',
                render: (row: DSRRow) => (
                  <span className="font-mono text-sm">PKR {row.grandTotal.toLocaleString()}</span>
                ),
              },
            ]}
            data={data.recentDSRs as DSRRow[]}
          />
        </div>
      </div>

      {/* Targets + AI */}
      <div className="grid gap-4 lg:grid-cols-3">
        {data.targets.length > 0 ? (
          <GaugeWidget
            title={data.targets[0].name}
            description="Organization target this period"
            value={data.targets[0].achieved}
            target={data.targets[0].target}
            prefix="PKR "
          />
        ) : (
          <div className="bg-muted flex items-center justify-center rounded-lg p-8 text-center">
            <div>
              <p className="font-medium">No Active Targets</p>
              <Button asChild variant="link" size="sm" className="mt-1">
                <Link href="/admin/targets">Set a target →</Link>
              </Button>
            </div>
          </div>
        )}
        <div className="lg:col-span-2">
          <AIInsightsCard />
        </div>
      </div>
    </div>
  )
}
