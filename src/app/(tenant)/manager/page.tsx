import { redirect } from 'next/navigation'
import { requireTenantAuth } from '@/lib/auth/require-tenant-auth'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { KPICard } from '@/components/widgets/kpi-card'
import { BarChartCard } from '@/components/widgets/chart-cards'
import { Leaderboard } from '@/components/widgets/leaderboard'
import { DataTableWidget } from '@/components/widgets/data-table-widget'
import { FilterBar } from '@/components/widgets/filter-bar'
import { ExportButton } from '@/components/widgets/export-button'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Clock, TrendingUp, Users, CheckCircle2 } from 'lucide-react'
import { format, startOfMonth, endOfDay } from 'date-fns'

export const metadata = { title: 'Manager Dashboard' }
export const dynamic = 'force-dynamic'

const STATUS_BADGE: Record<string, string> = {
  SUBMITTED: 'bg-yellow-100 text-yellow-700',
  APPROVED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
}

async function getData(orgId: string, managerId: string, from: Date, to: Date) {
  const manager = await prisma.user.findUnique({
    where: { id: managerId },
    select: { departmentId: true },
  })

  const teamUsers = await prisma.user.findMany({
    where: {
      organizationId: orgId,
      departmentId: manager?.departmentId ?? undefined,
      isActive: true,
      deletedAt: null,
      id: { not: managerId },
    },
    select: { id: true, name: true, avatar: true },
  })
  const teamIds = teamUsers.map((u) => u.id)

  const [pendingDSRs, teamRevenue, pendingQueue, dsrCounts] = await Promise.all([
    prisma.dSREntry.count({
      where: {
        organizationId: orgId,
        status: 'SUBMITTED',
        submittedById: { in: teamIds },
        deletedAt: null,
      },
    }),
    prisma.invoice.aggregate({
      where: {
        organizationId: orgId,
        createdById: { in: teamIds },
        issueDate: { gte: from, lte: to },
        deletedAt: null,
      },
      _sum: { grandTotal: true },
    }),
    prisma.dSREntry.findMany({
      where: {
        organizationId: orgId,
        status: 'SUBMITTED',
        submittedById: { in: teamIds },
        deletedAt: null,
      },
      orderBy: { createdAt: 'asc' },
      take: 15,
      select: {
        id: true,
        status: true,
        grandTotal: true,
        reportDate: true,
        createdAt: true,
        submittedBy: { select: { id: true, name: true } },
        client: { select: { id: true, companyName: true } },
      },
    }),
    prisma.dSREntry.groupBy({
      by: ['submittedById'],
      where: {
        organizationId: orgId,
        submittedById: { in: teamIds },
        reportDate: { gte: from, lte: to },
        deletedAt: null,
      },
      _count: true,
      _sum: { grandTotal: true },
    }),
  ])

  const performance = teamUsers
    .map((u, i) => {
      const stats = dsrCounts.find((d) => d.submittedById === u.id)
      return {
        rank: i + 1,
        id: u.id,
        name: u.name,
        avatar: u.avatar,
        dsrs: stats?._count ?? 0,
        value: Number(stats?._sum.grandTotal ?? 0),
      }
    })
    .sort((a, b) => b.value - a.value)
    .map((p, i) => ({ ...p, rank: i + 1 }))

  return {
    kpis: {
      teamSize: teamUsers.length,
      pendingDSRs,
      teamRevenue: Number(teamRevenue._sum.grandTotal ?? 0),
    },
    pendingQueue: pendingQueue.map((d) => ({ ...d, grandTotal: Number(d.grandTotal) })),
    teamPerformance: performance,
    teamBarData: performance
      .slice(0, 8)
      .map((p) => ({ name: p.name.split(' ')[0], dsrs: p.dsrs, revenue: p.value })),
  }
}

type PendingRow = {
  id: string
  status: string
  grandTotal: number
  reportDate: Date
  createdAt: Date
  submittedBy: { id: string; name: string }
  client: { id: string; companyName: string }
}

export default async function ManagerDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>
}) {
  const auth = await requireTenantAuth()
  if (!auth.ok) redirect('/login')
  const orgId = auth.session.organizationId
  const userId = auth.user.id

  const sp = await searchParams
  const now = new Date()
  const from = sp.from ? new Date(sp.from) : startOfMonth(now)
  const to = sp.to ? new Date(sp.to) : endOfDay(now)

  const data = await getData(orgId, userId, from, to)
  const exportData = data.pendingQueue.map((d: PendingRow) => ({
    Rep: d.submittedBy.name,
    Client: d.client.companyName,
    Date: format(new Date(d.reportDate), 'dd MMM yyyy'),
    Total: d.grandTotal,
  }))

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Manager Dashboard</h1>
          <p className="text-muted-foreground text-sm">{format(now, 'EEEE, MMMM d, yyyy')}</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/manager/dsr/pending">Review Queue ({data.kpis.pendingDSRs})</Link>
          </Button>
          <ExportButton data={exportData} filename="Manager Dashboard" />
        </div>
      </div>

      <FilterBar showDateRange />

      <div className="grid gap-4 sm:grid-cols-3">
        <KPICard
          label="Pending Approvals"
          value={data.kpis.pendingDSRs}
          icon={Clock}
          iconColor="text-yellow-600"
        />
        <KPICard
          label="Team Revenue"
          value={`PKR ${Math.round(data.kpis.teamRevenue).toLocaleString()}`}
          icon={TrendingUp}
          iconColor="text-green-600"
        />
        <KPICard
          label="Team Size"
          value={data.kpis.teamSize}
          icon={Users}
          iconColor="text-blue-600"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Leaderboard title="Team Performance" entries={data.teamPerformance} valuePrefix="PKR " />
        <BarChartCard
          title="DSRs by Rep"
          data={data.teamBarData}
          bars={[{ key: 'dsrs', label: 'DSRs', color: '#0369A1' }]}
        />
      </div>

      <DataTableWidget
        title="Pending DSR Queue"
        emptyMessage="No DSRs awaiting approval"
        action={
          <Button asChild variant="ghost" size="sm">
            <Link href="/manager/dsr/pending">View all →</Link>
          </Button>
        }
        columns={[
          { key: 'rep', label: 'Rep', render: (r: PendingRow) => r.submittedBy.name },
          { key: 'client', label: 'Client', render: (r: PendingRow) => r.client.companyName },
          {
            key: 'date',
            label: 'Date',
            render: (r: PendingRow) => (
              <span className="font-mono text-xs">{format(new Date(r.reportDate), 'dd MMM')}</span>
            ),
          },
          {
            key: 'total',
            label: 'Total',
            render: (r: PendingRow) => (
              <span className="font-mono text-sm">PKR {r.grandTotal.toLocaleString()}</span>
            ),
          },
          {
            key: 'action',
            label: '',
            render: (r: PendingRow) => (
              <Link
                href={`/manager/dsr/${r.id}`}
                className="text-accent text-xs font-medium hover:underline"
              >
                Review →
              </Link>
            ),
          },
        ]}
        data={data.pendingQueue as PendingRow[]}
      />
    </div>
  )
}
