import { redirect, notFound } from 'next/navigation'
import { requireTenantAuth } from '@/lib/auth/require-tenant-auth'
import { prisma } from '@/lib/prisma'
import { KPICard } from '@/components/widgets/kpi-card'
import { AreaChartCard } from '@/components/widgets/chart-cards'
import { DataTableWidget } from '@/components/widgets/data-table-widget'
import { GaugeWidget } from '@/components/widgets/gauge-widget'
import { ExportButton } from '@/components/widgets/export-button'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { ChevronLeft, DollarSign, Users, CreditCard } from 'lucide-react'
import { format, subMonths, startOfMonth } from 'date-fns'
import { cacheGet, cacheSet, dashboardKey } from '@/lib/dashboard-cache'

export const dynamic = 'force-dynamic'

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-800',
  INACTIVE: 'bg-gray-100 text-gray-700',
  PROSPECT: 'bg-yellow-100 text-yellow-800',
  CHURNED: 'bg-red-100 text-red-800',
}

const INV_STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  ISSUED: 'bg-blue-100 text-blue-700',
  PARTIALLY_PAID: 'bg-yellow-100 text-yellow-700',
  PAID: 'bg-green-100 text-green-700',
  OVERDUE: 'bg-red-100 text-red-700',
  CANCELLED: 'bg-gray-100 text-gray-500',
}

async function getData(orgId: string, id: string) {
  const cacheKey = dashboardKey(orgId, `distributor_${id}`)
  const cached = await cacheGet(cacheKey)
  if (cached) return cached as Awaited<ReturnType<typeof fetchData>>
  const result = await fetchData(orgId, id)
  await cacheSet(cacheKey, result)
  return result
}

async function fetchData(orgId: string, id: string) {
  const distributor = await prisma.distributor.findFirst({
    where: { id, organizationId: orgId, deletedAt: null },
  })
  if (!distributor) return null

  const now = new Date()
  const [clients, recentInvoices, monthlyRevenue] = await Promise.all([
    prisma.client.findMany({
      where: { distributorId: id, organizationId: orgId, deletedAt: null },
      select: {
        id: true,
        code: true,
        companyName: true,
        status: true,
        currentBalance: true,
        lastOrderDate: true,
      },
      orderBy: { totalLifetimeValue: 'desc' },
      take: 20,
    }),
    prisma.invoice.findMany({
      where: { distributorId: id, organizationId: orgId, deletedAt: null },
      orderBy: { issueDate: 'desc' },
      take: 10,
      select: {
        id: true,
        invoiceNumber: true,
        status: true,
        grandTotal: true,
        paidAmount: true,
        issueDate: true,
        dueDate: true,
      },
    }),
    Promise.all(
      Array.from({ length: 6 }).map(async (_, i) => {
        const d = subMonths(now, 5 - i)
        const agg = await prisma.invoice.aggregate({
          where: {
            distributorId: id,
            organizationId: orgId,
            issueDate: { gte: startOfMonth(d) },
            deletedAt: null,
          },
          _sum: { grandTotal: true, paidAmount: true },
        })
        return {
          name: format(d, 'MMM yy'),
          invoiced: Number(agg._sum.grandTotal ?? 0),
          collected: Number(agg._sum.paidAmount ?? 0),
        }
      })
    ),
  ])

  return {
    distributor: {
      id: distributor.id,
      name: distributor.companyName,
      code: distributor.code,
      status: distributor.status,
      tier: distributor.tier,
      creditLimit: Number(distributor.creditLimit),
      balance: Number(distributor.currentBalance),
      totalPurchases: Number(distributor.totalPurchases),
    },
    kpis: {
      clientCount: clients.length,
      balance: Number(distributor.currentBalance),
      creditLimit: Number(distributor.creditLimit),
      totalPurchases: Number(distributor.totalPurchases),
    },
    clients: clients.map((c) => ({ ...c, balance: Number(c.currentBalance) })),
    recentInvoices: recentInvoices.map((inv) => ({
      ...inv,
      grandTotal: Number(inv.grandTotal),
      paidAmount: Number(inv.paidAmount),
    })),
    monthlyRevenue,
  }
}

type ClientRow = {
  id: string
  code: string
  companyName: string
  status: string
  balance: number
  lastOrderDate: Date | null
}
type InvRow = {
  id: string
  invoiceNumber: string
  status: string
  grandTotal: number
  paidAmount: number
  issueDate: Date
  dueDate: Date | null
}

export default async function DistributorDashboardPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const auth = await requireTenantAuth('dashboard:read')
  if (!auth.ok) redirect('/login')
  const orgId = auth.session.organizationId
  const { id } = await params

  const data = await getData(orgId, id)
  if (!data) notFound()

  const exportData = data.clients.map((c: ClientRow) => ({
    Code: c.code,
    Name: c.companyName,
    Status: c.status,
    Balance: c.balance,
  }))

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm" className="gap-1">
          <Link href="/admin/distributors">
            <ChevronLeft className="h-4 w-4" />
            Distributors
          </Link>
        </Button>
        <span className="text-muted-foreground">/</span>
        <span className="font-medium">{data.distributor.name}</span>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">{data.distributor.name}</h1>
          <p className="text-muted-foreground text-sm">
            {data.distributor.code} · {data.distributor.tier} Tier
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/admin/distributors/${id}`}>View Profile</Link>
          </Button>
          <ExportButton data={exportData} filename={`${data.distributor.name} Dashboard`} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard
          label="Linked Clients"
          value={data.kpis.clientCount}
          icon={Users}
          iconColor="text-blue-600"
        />
        <KPICard
          label="Outstanding Balance"
          value={`PKR ${data.kpis.balance.toLocaleString()}`}
          icon={DollarSign}
          iconColor="text-red-600"
        />
        <KPICard
          label="Total Purchases"
          value={`PKR ${data.kpis.totalPurchases.toLocaleString()}`}
          icon={DollarSign}
          iconColor="text-green-600"
        />
        <GaugeWidget
          title="Credit Utilization"
          value={data.kpis.balance}
          target={data.kpis.creditLimit > 0 ? data.kpis.creditLimit : data.kpis.balance + 1}
          prefix="PKR "
        />
      </div>

      <AreaChartCard
        title="Revenue History"
        description="Invoiced vs Collected (last 6 months)"
        data={data.monthlyRevenue}
        areas={[
          { key: 'invoiced', label: 'Invoiced', color: '#0369A1' },
          { key: 'collected', label: 'Collected', color: '#22C55E' },
        ]}
        yPrefix="PKR "
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <DataTableWidget
          title="Linked Clients"
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
              key: 'status',
              label: 'Status',
              render: (r: ClientRow) => (
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[r.status] ?? ''}`}
                >
                  {r.status}
                </span>
              ),
            },
            {
              key: 'lastOrder',
              label: 'Last Order',
              render: (r: ClientRow) =>
                r.lastOrderDate ? (
                  <span className="font-mono text-xs">
                    {format(new Date(r.lastOrderDate), 'dd MMM yyyy')}
                  </span>
                ) : (
                  '—'
                ),
            },
          ]}
          data={data.clients as ClientRow[]}
        />
        <DataTableWidget
          title="Recent Invoices"
          columns={[
            {
              key: 'inv',
              label: 'Invoice',
              render: (r: InvRow) => (
                <Link
                  href={`/admin/invoices/${r.id}`}
                  className="font-mono text-xs font-medium hover:underline"
                >
                  {r.invoiceNumber}
                </Link>
              ),
            },
            {
              key: 'status',
              label: 'Status',
              render: (r: InvRow) => (
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${INV_STATUS_COLORS[r.status] ?? ''}`}
                >
                  {r.status}
                </span>
              ),
            },
            {
              key: 'total',
              label: 'Total',
              render: (r: InvRow) => (
                <span className="font-mono text-sm">PKR {r.grandTotal.toLocaleString()}</span>
              ),
            },
            {
              key: 'date',
              label: 'Date',
              render: (r: InvRow) => (
                <span className="font-mono text-xs">{format(new Date(r.issueDate), 'dd MMM')}</span>
              ),
            },
          ]}
          data={data.recentInvoices as InvRow[]}
        />
      </div>
    </div>
  )
}
