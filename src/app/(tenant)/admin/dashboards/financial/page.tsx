import { redirect } from 'next/navigation'
import { requireTenantAuth } from '@/lib/auth/require-tenant-auth'
import { prisma } from '@/lib/prisma'
import { KPICard } from '@/components/widgets/kpi-card'
import { AreaChartCard, BarChartCard, DonutChartCard } from '@/components/widgets/chart-cards'
import { DataTableWidget } from '@/components/widgets/data-table-widget'
import { GaugeWidget } from '@/components/widgets/gauge-widget'
import { FilterBar } from '@/components/widgets/filter-bar'
import { ExportButton } from '@/components/widgets/export-button'
import { DollarSign, TrendingDown, Clock, AlertTriangle } from 'lucide-react'
import { format, subMonths, startOfMonth, endOfMonth, endOfDay } from 'date-fns'
import { cacheGet, cacheSet, dashboardKey } from '@/lib/dashboard-cache'
import Link from 'next/link'

export const metadata = { title: 'Financial Dashboard' }
export const dynamic = 'force-dynamic'

async function getData(orgId: string, from: Date, to: Date) {
  const cacheKey = dashboardKey(
    orgId,
    'financial',
    `${from.toISOString().slice(0, 10)}_${to.toISOString().slice(0, 10)}`
  )
  const cached = await cacheGet(cacheKey)
  if (cached) return cached as Awaited<ReturnType<typeof fetchData>>
  const result = await fetchData(orgId, from, to)
  await cacheSet(cacheKey, result)
  return result
}

async function fetchData(orgId: string, from: Date, to: Date) {
  const now = new Date()
  const [invoiced, collected, outstanding, overdue, methodDist, overdueList] = await Promise.all([
    prisma.invoice.aggregate({
      where: { organizationId: orgId, issueDate: { gte: from, lte: to }, deletedAt: null },
      _sum: { grandTotal: true },
    }),
    prisma.payment.aggregate({
      where: { organizationId: orgId, paymentDate: { gte: from, lte: to }, deletedAt: null },
      _sum: { amount: true },
    }),
    prisma.invoice.aggregate({
      where: {
        organizationId: orgId,
        status: { in: ['ISSUED', 'PARTIALLY_PAID'] },
        deletedAt: null,
      },
      _sum: { grandTotal: true, paidAmount: true },
    }),
    prisma.invoice.aggregate({
      where: { organizationId: orgId, status: 'OVERDUE', deletedAt: null },
      _sum: { grandTotal: true, paidAmount: true },
    }),
    prisma.payment.groupBy({
      by: ['method'],
      where: { organizationId: orgId, paymentDate: { gte: from, lte: to }, deletedAt: null },
      _sum: { amount: true },
    }),
    prisma.invoice.findMany({
      where: { organizationId: orgId, status: 'OVERDUE', deletedAt: null },
      orderBy: { dueDate: 'asc' },
      take: 10,
      select: {
        id: true,
        invoiceNumber: true,
        grandTotal: true,
        paidAmount: true,
        dueDate: true,
        client: { select: { id: true, companyName: true } },
      },
    }),
  ])

  // AR Aging
  const allOutstanding = await prisma.invoice.findMany({
    where: {
      organizationId: orgId,
      status: { in: ['OVERDUE', 'ISSUED', 'PARTIALLY_PAID'] },
      deletedAt: null,
    },
    select: { grandTotal: true, paidAmount: true, dueDate: true },
  })
  const aging = { b1: 0, b2: 0, b3: 0, b4: 0 }
  for (const inv of allOutstanding) {
    if (!inv.dueDate) continue
    const daysOverdue = Math.floor((now.getTime() - inv.dueDate.getTime()) / 86400000)
    const amt = Number(inv.grandTotal) - Number(inv.paidAmount)
    if (amt <= 0) continue
    if (daysOverdue <= 30) aging.b1 += amt
    else if (daysOverdue <= 60) aging.b2 += amt
    else if (daysOverdue <= 90) aging.b3 += amt
    else aging.b4 += amt
  }

  // Monthly cash flow (6 months)
  const cashFlow = await Promise.all(
    Array.from({ length: 6 }).map(async (_, i) => {
      const d = subMonths(now, 5 - i)
      const [inv, pay] = await Promise.all([
        prisma.invoice.aggregate({
          where: {
            organizationId: orgId,
            issueDate: { gte: startOfMonth(d), lte: endOfMonth(d) },
            deletedAt: null,
          },
          _sum: { grandTotal: true },
        }),
        prisma.payment.aggregate({
          where: {
            organizationId: orgId,
            paymentDate: { gte: startOfMonth(d), lte: endOfMonth(d) },
            deletedAt: null,
          },
          _sum: { amount: true },
        }),
      ])
      return {
        name: format(d, 'MMM yy'),
        invoiced: Number(inv._sum.grandTotal ?? 0),
        collected: Number(pay._sum.amount ?? 0),
      }
    })
  )

  const totalInvoiced = Number(invoiced._sum.grandTotal ?? 0)
  const totalCollected = Number(collected._sum.amount ?? 0)
  const outstandingAmt =
    Number(outstanding._sum.grandTotal ?? 0) - Number(outstanding._sum.paidAmount ?? 0)
  const overdueAmt = Number(overdue._sum.grandTotal ?? 0) - Number(overdue._sum.paidAmount ?? 0)

  return {
    kpis: {
      invoiced: totalInvoiced,
      collected: totalCollected,
      outstanding: Math.max(outstandingAmt, 0),
      overdue: Math.max(overdueAmt, 0),
      collectionRate: totalInvoiced > 0 ? (totalCollected / totalInvoiced) * 100 : 0,
    },
    cashFlow,
    aging: [
      { name: '0–30 days', value: Math.round(aging.b1) },
      { name: '31–60 days', value: Math.round(aging.b2) },
      { name: '61–90 days', value: Math.round(aging.b3) },
      { name: '90+ days', value: Math.round(aging.b4) },
    ],
    methodDist: methodDist.map((m) => ({ name: m.method, value: Number(m._sum.amount ?? 0) })),
    overdueList: overdueList.map((inv) => ({
      ...inv,
      grandTotal: Number(inv.grandTotal),
      paidAmount: Number(inv.paidAmount),
      outstanding: Number(inv.grandTotal) - Number(inv.paidAmount),
      daysOverdue: inv.dueDate ? Math.floor((now.getTime() - inv.dueDate.getTime()) / 86400000) : 0,
    })),
  }
}

type OverdueRow = {
  id: string
  invoiceNumber: string
  grandTotal: number
  paidAmount: number
  outstanding: number
  dueDate: Date | null
  daysOverdue: number
  client: { id: string; companyName: string }
}

export default async function FinancialDashboardPage({
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
  const exportData = data.overdueList.map((inv: OverdueRow) => ({
    Invoice: inv.invoiceNumber,
    Client: inv.client.companyName,
    Total: inv.grandTotal,
    Outstanding: inv.outstanding,
    DaysOverdue: inv.daysOverdue,
  }))

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Financial Dashboard</h1>
          <p className="text-muted-foreground text-sm">Cash flow, collections, and AR aging</p>
        </div>
        <ExportButton data={exportData} filename="Financial Dashboard" />
      </div>

      <FilterBar showDateRange />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard
          label="Invoiced"
          value={Math.round(data.kpis.invoiced).toLocaleString()}
          prefix="PKR "
          icon={DollarSign}
          iconColor="text-blue-600"
        />
        <KPICard
          label="Collected"
          value={Math.round(data.kpis.collected).toLocaleString()}
          prefix="PKR "
          icon={DollarSign}
          iconColor="text-green-600"
        />
        <KPICard
          label="Outstanding"
          value={Math.round(data.kpis.outstanding).toLocaleString()}
          prefix="PKR "
          icon={Clock}
          iconColor="text-yellow-600"
        />
        <KPICard
          label="Overdue"
          value={Math.round(data.kpis.overdue).toLocaleString()}
          prefix="PKR "
          icon={AlertTriangle}
          iconColor="text-red-600"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <AreaChartCard
            title="Cash Flow"
            description="Invoiced vs Collected (last 6 months)"
            data={data.cashFlow}
            areas={[
              { key: 'invoiced', label: 'Invoiced', color: '#0369A1' },
              { key: 'collected', label: 'Collected', color: '#22C55E' },
            ]}
            yPrefix="PKR "
          />
        </div>
        <GaugeWidget
          title="Collection Rate"
          value={Math.round(data.kpis.collected)}
          target={Math.round(data.kpis.invoiced)}
          prefix="PKR "
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <BarChartCard
          title="AR Aging"
          description="Outstanding by overdue bracket"
          data={data.aging}
          bars={[{ key: 'value', label: 'PKR', color: '#EF4444' }]}
          yPrefix="PKR "
        />
        <DonutChartCard
          title="Payment Methods"
          data={data.methodDist.map((m, i) => ({
            name: m.name,
            value: Math.round(m.value),
            color: ['#0369A1', '#22C55E', '#F59E0B', '#8B5CF6', '#EF4444', '#06B6D4'][i % 6],
          }))}
        />
        <DataTableWidget
          title="Overdue Invoices"
          emptyMessage="No overdue invoices"
          columns={[
            {
              key: 'invoice',
              label: 'Invoice',
              render: (r: OverdueRow) => (
                <Link
                  href={`/admin/invoices/${r.id}`}
                  className="font-mono text-xs font-medium hover:underline"
                >
                  {r.invoiceNumber}
                </Link>
              ),
            },
            { key: 'client', label: 'Client', render: (r: OverdueRow) => r.client.companyName },
            {
              key: 'outstanding',
              label: 'Outstanding',
              render: (r: OverdueRow) => (
                <span className="font-mono text-sm text-red-600">
                  PKR {r.outstanding.toLocaleString()}
                </span>
              ),
            },
            {
              key: 'days',
              label: 'Days',
              render: (r: OverdueRow) => (
                <span className="font-mono text-xs text-red-600">{r.daysOverdue}d</span>
              ),
            },
          ]}
          data={data.overdueList as OverdueRow[]}
        />
      </div>
    </div>
  )
}
