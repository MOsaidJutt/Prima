import { redirect } from 'next/navigation'
import { requireTenantAuth } from '@/lib/auth/require-tenant-auth'
import { prisma } from '@/lib/prisma'
import { KPICard } from '@/components/widgets/kpi-card'
import { BarChartCard } from '@/components/widgets/chart-cards'
import { Leaderboard } from '@/components/widgets/leaderboard'
import { DataTableWidget } from '@/components/widgets/data-table-widget'
import { FilterBar } from '@/components/widgets/filter-bar'
import { ExportButton } from '@/components/widgets/export-button'
import Link from 'next/link'
import { Users, BarChart3, TrendingUp } from 'lucide-react'
import { startOfMonth, endOfDay } from 'date-fns'
import { cacheGet, cacheSet, dashboardKey } from '@/lib/dashboard-cache'

export const metadata = { title: 'Employee Performance Reports' }
export const dynamic = 'force-dynamic'

async function getData(orgId: string, from: Date, to: Date, deptId?: string) {
  const cacheKey = dashboardKey(
    orgId,
    'epr',
    `${from.toISOString().slice(0, 10)}_${to.toISOString().slice(0, 10)}_${deptId ?? ''}`
  )
  const cached = await cacheGet(cacheKey)
  if (cached) return cached as Awaited<ReturnType<typeof fetchData>>
  const result = await fetchData(orgId, from, to, deptId)
  await cacheSet(cacheKey, result)
  return result
}

async function fetchData(orgId: string, from: Date, to: Date, deptId?: string) {
  const userWhere = {
    organizationId: orgId,
    isActive: true,
    deletedAt: null,
    ...(deptId ? { departmentId: deptId } : {}),
  }
  const users = await prisma.user.findMany({
    where: userWhere,
    select: { id: true, name: true, avatar: true, department: { select: { name: true } } },
  })
  const userIds = users.map((u) => u.id)

  const [dsrCounts, revenues] = await Promise.all([
    prisma.dSREntry.groupBy({
      by: ['submittedById', 'status'],
      where: {
        organizationId: orgId,
        reportDate: { gte: from, lte: to },
        submittedById: { in: userIds },
        deletedAt: null,
      },
      _count: true,
    }),
    prisma.invoice.groupBy({
      by: ['createdById'],
      where: {
        organizationId: orgId,
        issueDate: { gte: from, lte: to },
        createdById: { in: userIds },
        deletedAt: null,
      },
      _sum: { grandTotal: true },
    }),
  ])

  const performance = users
    .map((user) => {
      const userDSRs = dsrCounts.filter((d) => d.submittedById === user.id)
      const total = userDSRs.reduce((s, d) => s + d._count, 0)
      const approved = userDSRs.find((d) => d.status === 'APPROVED')?._count ?? 0
      const rev = revenues.find((r) => r.createdById === user.id)
      return {
        id: user.id,
        name: user.name,
        avatar: user.avatar,
        department: user.department?.name ?? '—',
        dsrCount: total,
        approvedDSRs: approved,
        approvalRate: total > 0 ? (approved / total) * 100 : 0,
        revenue: Number(rev?._sum.grandTotal ?? 0),
        value: Number(rev?._sum.grandTotal ?? 0),
      }
    })
    .sort((a, b) => b.revenue - a.revenue)
    .map((p, i) => ({ ...p, rank: i + 1 }))

  const avgDSR =
    performance.length > 0
      ? performance.reduce((s, p) => s + p.dsrCount, 0) / performance.length
      : 0
  const avgRev =
    performance.length > 0 ? performance.reduce((s, p) => s + p.revenue, 0) / performance.length : 0

  return {
    kpis: {
      activeReps: performance.length,
      avgDSR: Math.round(avgDSR),
      avgRevenue: Math.round(avgRev),
    },
    performance,
  }
}

type PerfRow = {
  id: string
  rank: number
  name: string
  avatar: string | null
  department: string
  dsrCount: number
  approvedDSRs: number
  approvalRate: number
  revenue: number
  value: number
}

export default async function EPRPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; dept?: string }>
}) {
  const auth = await requireTenantAuth('dashboard:read')
  if (!auth.ok) redirect('/login')
  const orgId = auth.session.organizationId

  const sp = await searchParams
  const now = new Date()
  const from = sp.from ? new Date(sp.from) : startOfMonth(now)
  const to = sp.to ? new Date(sp.to) : endOfDay(now)

  const [data, departments] = await Promise.all([
    getData(orgId, from, to, sp.dept),
    prisma.department.findMany({
      where: { organizationId: orgId, deletedAt: null },
      select: { id: true, name: true },
    }),
  ])

  const exportData = data.performance.map((p: PerfRow) => ({
    Name: p.name,
    Department: p.department,
    DSRs: p.dsrCount,
    ApprovedDSRs: p.approvedDSRs,
    ApprovalRate: `${p.approvalRate.toFixed(1)}%`,
    Revenue: p.revenue,
  }))

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Employee Performance Reports</h1>
          <p className="text-muted-foreground text-sm">Team-wide performance metrics</p>
        </div>
        <ExportButton data={exportData} filename="Employee Performance" />
      </div>

      <FilterBar showDateRange showDepartment departments={departments} />

      <div className="grid gap-4 sm:grid-cols-3">
        <KPICard
          label="Active Reps"
          value={data.kpis.activeReps}
          icon={Users}
          iconColor="text-blue-600"
        />
        <KPICard
          label="Avg DSRs/Rep"
          value={data.kpis.avgDSR}
          icon={BarChart3}
          iconColor="text-accent"
        />
        <KPICard
          label="Avg Revenue/Rep"
          value={`PKR ${data.kpis.avgRevenue.toLocaleString()}`}
          icon={TrendingUp}
          iconColor="text-green-600"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Leaderboard
          title="Top Performers"
          description="By revenue this period"
          entries={data.performance.map((p: PerfRow) => ({
            rank: p.rank,
            id: p.id,
            name: p.name,
            avatar: p.avatar,
            value: p.revenue,
            subtitle: p.department,
          }))}
          valuePrefix="PKR "
        />
        <BarChartCard
          title="DSRs by Rep"
          data={data.performance
            .slice(0, 10)
            .map((p: PerfRow) => ({
              name: p.name.split(' ')[0],
              approved: p.approvedDSRs,
              total: p.dsrCount,
            }))}
          bars={[
            { key: 'approved', label: 'Approved', color: '#22C55E' },
            { key: 'total', label: 'Total', color: '#0369A1' },
          ]}
        />
      </div>

      <DataTableWidget
        title="All Reps — Performance Table"
        columns={[
          {
            key: 'rank',
            label: '#',
            render: (r: PerfRow) => (
              <span className="text-muted-foreground font-mono text-sm">{r.rank}</span>
            ),
          },
          {
            key: 'name',
            label: 'Name',
            render: (r: PerfRow) => (
              <Link href={`/admin/dashboards/epr/${r.id}`} className="font-medium hover:underline">
                {r.name}
              </Link>
            ),
          },
          {
            key: 'department',
            label: 'Department',
            render: (r: PerfRow) => (
              <span className="text-muted-foreground text-sm">{r.department}</span>
            ),
          },
          { key: 'dsrCount', label: 'DSRs', render: (r: PerfRow) => r.dsrCount },
          {
            key: 'approvalRate',
            label: 'Approval Rate',
            render: (r: PerfRow) => (
              <span className="font-mono text-sm">{r.approvalRate.toFixed(1)}%</span>
            ),
          },
          {
            key: 'revenue',
            label: 'Revenue',
            render: (r: PerfRow) => (
              <span className="font-mono text-sm font-semibold">
                PKR {r.revenue.toLocaleString()}
              </span>
            ),
          },
          {
            key: 'detail',
            label: '',
            render: (r: PerfRow) => (
              <Link
                href={`/admin/dashboards/epr/${r.id}`}
                className="text-accent text-xs hover:underline"
              >
                View →
              </Link>
            ),
          },
        ]}
        data={data.performance as PerfRow[]}
      />
    </div>
  )
}
