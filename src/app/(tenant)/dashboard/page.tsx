import { redirect } from 'next/navigation'
import { requireTenantAuth } from '@/lib/auth/require-tenant-auth'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { KPICard } from '@/components/widgets/kpi-card'
import { LineChartCard } from '@/components/widgets/chart-cards'
import { GaugeWidget } from '@/components/widgets/gauge-widget'
import { DataTableWidget } from '@/components/widgets/data-table-widget'
import { FilterBar } from '@/components/widgets/filter-bar'
import { ExportButton } from '@/components/widgets/export-button'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  FileText,
  PlusCircle,
  TrendingUp,
  CheckCircle2,
  Clock,
  DollarSign,
  Users,
} from 'lucide-react'
import { format, subMonths, startOfMonth, endOfDay } from 'date-fns'

export const metadata = { title: 'My Dashboard' }
export const dynamic = 'force-dynamic'

const STATUS_BADGE: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  SUBMITTED: 'bg-yellow-100 text-yellow-700',
  APPROVED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
}

async function getData(orgId: string, userId: string, from: Date, to: Date) {
  const now = new Date()

  const [dsrStats, revAgg, targets, recentDSRs, pendingInvoices, monthlyPerf, clientsVisited] =
    await Promise.all([
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
        where: {
          organizationId: orgId,
          userId,
          isActive: true,
          deletedAt: null,
          periodStart: { lte: to },
          periodEnd: { gte: from },
        },
        take: 3,
        select: { name: true, targetValue: true, achievedValue: true, type: true },
      }),
      prisma.dSREntry.findMany({
        where: { organizationId: orgId, submittedById: userId, deletedAt: null },
        orderBy: { reportDate: 'desc' },
        take: 8,
        select: {
          id: true,
          status: true,
          grandTotal: true,
          reportDate: true,
          client: { select: { companyName: true } },
        },
      }),
      prisma.invoice.findMany({
        where: {
          organizationId: orgId,
          createdById: userId,
          status: { in: ['ISSUED', 'OVERDUE', 'PARTIALLY_PAID'] },
          deletedAt: null,
        },
        orderBy: { dueDate: 'asc' },
        take: 5,
        select: {
          id: true,
          invoiceNumber: true,
          status: true,
          grandTotal: true,
          paidAmount: true,
          dueDate: true,
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
      prisma.dSREntry.groupBy({
        by: ['clientId'],
        where: {
          organizationId: orgId,
          submittedById: userId,
          reportDate: { gte: from, lte: to },
          deletedAt: null,
        },
        _count: true,
      }),
    ])

  const totalDSRs = dsrStats.reduce((s, d) => s + d._count, 0)
  const approved = dsrStats.find((d) => d.status === 'APPROVED')?._count ?? 0

  return {
    kpis: {
      totalDSRs,
      approvedDSRs: approved,
      approvalRate: totalDSRs > 0 ? (approved / totalDSRs) * 100 : 0,
      revenue: Number(revAgg._sum.grandTotal ?? 0),
      collected: Number(revAgg._sum.paidAmount ?? 0),
      clientsVisited: clientsVisited.length,
    },
    targets: targets.map((t) => ({
      name: t.name,
      target: Number(t.targetValue),
      achieved: Number(t.achievedValue),
      type: t.type,
    })),
    recentDSRs: recentDSRs.map((d) => ({ ...d, grandTotal: Number(d.grandTotal) })),
    pendingInvoices: pendingInvoices.map((inv) => ({
      ...inv,
      grandTotal: Number(inv.grandTotal),
      paidAmount: Number(inv.paidAmount),
    })),
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
type InvRow = {
  id: string
  invoiceNumber: string
  status: string
  grandTotal: number
  paidAmount: number
  dueDate: Date | null
  client: { companyName: string }
}

export default async function SalesRepDashboardPage({
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
  const exportData = data.recentDSRs.map((d: DSRRow) => ({
    Date: format(new Date(d.reportDate), 'dd MMM yyyy'),
    Client: d.client.companyName,
    Status: d.status,
    Total: d.grandTotal,
  }))

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">My Dashboard</h1>
          <p className="text-muted-foreground text-sm">{format(now, 'EEEE, MMMM d, yyyy')}</p>
        </div>
        <div className="flex gap-2">
          <Button asChild size="sm">
            <Link href="/dashboard/dsr/new">
              <PlusCircle className="mr-1.5 h-4 w-4" />
              New DSR
            </Link>
          </Button>
          <ExportButton data={exportData} filename="My Dashboard" />
        </div>
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
          label="Approved"
          value={data.kpis.approvedDSRs}
          icon={CheckCircle2}
          iconColor="text-green-600"
        />
        <KPICard
          label="Revenue"
          value={`PKR ${data.kpis.revenue.toLocaleString()}`}
          icon={DollarSign}
          iconColor="text-green-600"
        />
        <KPICard
          label="Clients Visited"
          value={data.kpis.clientsVisited}
          icon={Users}
          iconColor="text-accent"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <LineChartCard
            title="My Performance"
            description="DSRs submitted (last 6 months)"
            data={data.monthlyPerf}
            lines={[
              { key: 'dsrs', label: 'DSRs', color: '#0369A1' },
              { key: 'revenue', label: 'Revenue', color: '#22C55E' },
            ]}
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
              <p className="text-muted-foreground mt-1 text-xs">
                Your manager will assign targets here
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <DataTableWidget
          title="Recent DSRs"
          action={
            <Button asChild variant="ghost" size="sm">
              <Link href="/dashboard/dsr">View all →</Link>
            </Button>
          }
          columns={[
            {
              key: 'date',
              label: 'Date',
              render: (r: DSRRow) => (
                <span className="font-mono text-xs">
                  {format(new Date(r.reportDate), 'dd MMM')}
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
                <Link
                  href={`/dashboard/dsr/${r.id}`}
                  className="text-accent text-xs hover:underline"
                >
                  View →
                </Link>
              ),
            },
          ]}
          data={data.recentDSRs as DSRRow[]}
        />
        <DataTableWidget
          title="My Pending Invoices"
          emptyMessage="No pending invoices"
          columns={[
            {
              key: 'inv',
              label: 'Invoice',
              render: (r: InvRow) => <span className="font-mono text-xs">{r.invoiceNumber}</span>,
            },
            { key: 'client', label: 'Client', render: (r: InvRow) => r.client.companyName },
            {
              key: 'outstanding',
              label: 'Outstanding',
              render: (r: InvRow) => (
                <span className="font-mono text-sm">
                  PKR {(r.grandTotal - r.paidAmount).toLocaleString()}
                </span>
              ),
            },
            {
              key: 'due',
              label: 'Due',
              render: (r: InvRow) =>
                r.dueDate ? (
                  <span className="font-mono text-xs">{format(new Date(r.dueDate), 'dd MMM')}</span>
                ) : (
                  '—'
                ),
            },
          ]}
          data={data.pendingInvoices as InvRow[]}
        />
      </div>
    </div>
  )
}
