import { redirect, notFound } from 'next/navigation'
import { requireTenantAuth } from '@/lib/auth/require-tenant-auth'
import { prisma } from '@/lib/prisma'
import { KPICard } from '@/components/widgets/kpi-card'
import { LineChartCard } from '@/components/widgets/chart-cards'
import { GaugeWidget } from '@/components/widgets/gauge-widget'
import { DataTableWidget } from '@/components/widgets/data-table-widget'
import { FilterBar } from '@/components/widgets/filter-bar'
import { ExportButton } from '@/components/widgets/export-button'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { ChevronLeft, FileText, DollarSign, Users, TrendingUp } from 'lucide-react'
import { format, subMonths, startOfMonth, endOfDay } from 'date-fns'
import { cacheGet, cacheSet, dashboardKey } from '@/lib/dashboard-cache'

export const dynamic = 'force-dynamic'

const STATUS_BADGE: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  SUBMITTED: 'bg-blue-100 text-blue-700',
  APPROVED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
}

async function getData(orgId: string, userId: string, from: Date, to: Date) {
  const cacheKey = dashboardKey(
    orgId,
    `epr_${userId}`,
    `${from.toISOString().slice(0, 10)}_${to.toISOString().slice(0, 10)}`
  )
  const cached = await cacheGet(cacheKey)
  if (cached) return cached as Awaited<ReturnType<typeof fetchData>>
  const result = await fetchData(orgId, userId, from, to)
  await cacheSet(cacheKey, result)
  return result
}

async function fetchData(orgId: string, userId: string, from: Date, to: Date) {
  const user = await prisma.user.findFirst({
    where: { id: userId, organizationId: orgId, deletedAt: null },
    select: {
      id: true,
      name: true,
      avatar: true,
      department: { select: { name: true } },
      role: { select: { name: true } },
    },
  })
  if (!user) return null

  const now = new Date()
  const [dsrStats, revAgg, targets, recentDSRs, monthlyPerf] = await Promise.all([
    prisma.dSREntry.groupBy({
      by: ['status'],
      where: {
        organizationId: orgId,
        submittedById: userId,
        reportDate: { gte: from, lte: to },
        deletedAt: null,
      },
      _count: true,
    }),
    prisma.invoice.aggregate({
      where: {
        organizationId: orgId,
        createdById: userId,
        issueDate: { gte: from, lte: to },
        deletedAt: null,
      },
      _sum: { grandTotal: true, paidAmount: true },
    }),
    prisma.salesTarget.findMany({
      where: { organizationId: orgId, userId, isActive: true, deletedAt: null },
      take: 3,
      select: { name: true, targetValue: true, achievedValue: true, type: true },
    }),
    prisma.dSREntry.findMany({
      where: { organizationId: orgId, submittedById: userId, deletedAt: null },
      orderBy: { reportDate: 'desc' },
      take: 10,
      select: {
        id: true,
        status: true,
        grandTotal: true,
        reportDate: true,
        client: { select: { companyName: true } },
      },
    }),
    Promise.all(
      Array.from({ length: 6 }).map(async (_, i) => {
        const d = subMonths(now, 5 - i)
        const [cnt, agg] = await Promise.all([
          prisma.dSREntry.count({
            where: {
              organizationId: orgId,
              submittedById: userId,
              reportDate: { gte: startOfMonth(d) },
              deletedAt: null,
            },
          }),
          prisma.invoice.aggregate({
            where: {
              organizationId: orgId,
              createdById: userId,
              issueDate: { gte: startOfMonth(d) },
              deletedAt: null,
            },
            _sum: { grandTotal: true },
          }),
        ])
        return { name: format(d, 'MMM yy'), dsrs: cnt, revenue: Number(agg._sum.grandTotal ?? 0) }
      })
    ),
  ])

  const totalDSRs = dsrStats.reduce((s, d) => s + d._count, 0)
  const approved = dsrStats.find((d) => d.status === 'APPROVED')?._count ?? 0

  return {
    user: {
      id: user.id,
      name: user.name,
      avatar: user.avatar,
      department: user.department?.name,
      role: user.role.name,
    },
    kpis: {
      totalDSRs,
      approvedDSRs: approved,
      approvalRate: totalDSRs > 0 ? (approved / totalDSRs) * 100 : 0,
      revenue: Number(revAgg._sum.grandTotal ?? 0),
      collected: Number(revAgg._sum.paidAmount ?? 0),
    },
    targets: targets.map((t) => ({
      name: t.name,
      target: Number(t.targetValue),
      achieved: Number(t.achievedValue),
      type: t.type,
    })),
    recentDSRs: recentDSRs.map((d) => ({ ...d, grandTotal: Number(d.grandTotal) })),
    monthlyPerf,
  }
}

type DSRRow = {
  id: string
  status: string
  grandTotal: number
  reportDate: Date
  client: { companyName: string }
}

export default async function EmployeeDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ userId: string }>
  searchParams: Promise<{ from?: string; to?: string }>
}) {
  const auth = await requireTenantAuth('dashboard:read')
  if (!auth.ok) redirect('/login')
  const orgId = auth.session.organizationId

  const { userId } = await params
  const sp = await searchParams
  const now = new Date()
  const from = sp.from ? new Date(sp.from) : startOfMonth(now)
  const to = sp.to ? new Date(sp.to) : endOfDay(now)

  const data = await getData(orgId, userId, from, to)
  if (!data) notFound()

  const exportData = data.recentDSRs.map((d: DSRRow) => ({
    Date: format(new Date(d.reportDate), 'dd MMM yyyy'),
    Client: d.client.companyName,
    Status: d.status,
    Total: d.grandTotal,
  }))

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm" className="gap-1">
          <Link href="/admin/dashboards/epr">
            <ChevronLeft className="h-4 w-4" />
            Back to EPR
          </Link>
        </Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-accent/10 text-accent flex h-12 w-12 items-center justify-center rounded-full text-lg font-bold">
            {data.user.name
              .split(' ')
              .map((n: string) => n[0])
              .slice(0, 2)
              .join('')}
          </div>
          <div>
            <h1 className="text-xl font-bold">{data.user.name}</h1>
            <p className="text-muted-foreground text-sm">
              {data.user.role} · {data.user.department ?? 'No Department'}
            </p>
          </div>
        </div>
        <ExportButton data={exportData} filename={`${data.user.name} Performance`} />
      </div>

      <FilterBar showDateRange />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard
          label="DSRs Submitted"
          value={data.kpis.totalDSRs}
          icon={FileText}
          iconColor="text-blue-600"
        />
        <KPICard
          label="Approved DSRs"
          value={data.kpis.approvedDSRs}
          icon={FileText}
          iconColor="text-green-600"
        />
        <KPICard
          label="Revenue"
          value={`PKR ${data.kpis.revenue.toLocaleString()}`}
          icon={DollarSign}
          iconColor="text-green-600"
        />
        <KPICard
          label="Collected"
          value={`PKR ${data.kpis.collected.toLocaleString()}`}
          icon={TrendingUp}
          iconColor="text-accent"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <LineChartCard
            title="Performance Trend"
            description="DSRs and revenue (last 6 months)"
            data={data.monthlyPerf}
            lines={[{ key: 'dsrs', label: 'DSRs', color: '#0369A1' }]}
          />
        </div>
        {data.targets.length > 0 ? (
          <GaugeWidget
            title={data.targets[0].name}
            value={data.targets[0].achieved}
            target={data.targets[0].target}
            prefix="PKR "
          />
        ) : (
          <div className="bg-card border-border flex items-center justify-center rounded-lg border p-6 text-center">
            <div>
              <p className="font-medium">No Active Targets</p>
              <Button asChild variant="link" size="sm">
                <Link href="/admin/targets">Assign target →</Link>
              </Button>
            </div>
          </div>
        )}
      </div>

      <DataTableWidget
        title="Recent DSRs"
        columns={[
          {
            key: 'date',
            label: 'Date',
            render: (r: DSRRow) => (
              <span className="font-mono text-xs">
                {format(new Date(r.reportDate), 'dd MMM yyyy')}
              </span>
            ),
          },
          { key: 'client', label: 'Client', render: (r: DSRRow) => r.client.companyName },
          {
            key: 'status',
            label: 'Status',
            render: (r: DSRRow) => (
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[r.status] ?? ''}`}
              >
                {r.status}
              </span>
            ),
          },
          {
            key: 'total',
            label: 'Total',
            render: (r: DSRRow) => (
              <span className="font-mono text-sm">PKR {r.grandTotal.toLocaleString()}</span>
            ),
          },
          {
            key: 'link',
            label: '',
            render: (r: DSRRow) => (
              <Link href={`/dashboard/dsr/${r.id}`} className="text-accent text-xs hover:underline">
                View →
              </Link>
            ),
          },
        ]}
        data={data.recentDSRs as DSRRow[]}
      />
    </div>
  )
}
