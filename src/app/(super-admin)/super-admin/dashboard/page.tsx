import { getSuperAdminSession } from '@/lib/auth/session'
import { redirect } from 'next/navigation'
import { KPICard } from '@/components/widgets/kpi-card'
import { BarChartCard, DonutChartCard } from '@/components/widgets/chart-cards'
import { DataTableWidget } from '@/components/widgets/data-table-widget'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Building2, Users, TrendingUp, AlertCircle, Plus, Activity } from 'lucide-react'
import Link from 'next/link'
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns'
import { prisma } from '@/lib/prisma'

export const metadata = { title: 'Platform Dashboard' }
export const dynamic = 'force-dynamic'

async function getDirectData() {
  const now = new Date()
  const thisMonthStart = startOfMonth(now)
  const lastMonthStart = startOfMonth(subMonths(now, 1))
  const lastMonthEnd = endOfMonth(subMonths(now, 1))

  const [
    totalOrgs,
    activeOrgs,
    trialOrgs,
    suspendedOrgs,
    cancelledOrgs,
    newThisMonth,
    newLastMonth,
    recentOrgs,
    planDist,
  ] = await Promise.all([
    prisma.organization.count({ where: { deletedAt: null } }),
    prisma.organization.count({ where: { status: 'ACTIVE', deletedAt: null } }),
    prisma.organization.count({ where: { status: 'TRIAL', deletedAt: null } }),
    prisma.organization.count({ where: { status: 'SUSPENDED', deletedAt: null } }),
    prisma.organization.count({ where: { status: 'CANCELLED', deletedAt: null } }),
    prisma.organization.count({ where: { createdAt: { gte: thisMonthStart }, deletedAt: null } }),
    prisma.organization.count({
      where: { createdAt: { gte: lastMonthStart, lte: lastMonthEnd }, deletedAt: null },
    }),
    prisma.organization.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { id: true, name: true, slug: true, status: true, plan: true, createdAt: true },
    }),
    prisma.organization.groupBy({ by: ['plan'], where: { deletedAt: null }, _count: true }),
  ])

  const monthlyGrowth = await Promise.all(
    Array.from({ length: 6 }).map(async (_, i) => {
      const d = subMonths(now, 5 - i)
      const count = await prisma.organization.count({
        where: { createdAt: { gte: startOfMonth(d), lte: endOfMonth(d) }, deletedAt: null },
      })
      return { name: format(d, 'MMM yy'), count }
    })
  )

  return {
    kpis: {
      totalOrgs,
      activeOrgs,
      trialOrgs,
      suspendedOrgs,
      cancelledOrgs,
      newThisMonth,
      signupTrend: newLastMonth > 0 ? ((newThisMonth - newLastMonth) / newLastMonth) * 100 : 0,
    },
    planDistribution: planDist.map((p) => ({ name: p.plan, value: p._count })),
    statusDist: [
      { name: 'Active', value: activeOrgs },
      { name: 'Trial', value: trialOrgs },
      { name: 'Suspended', value: suspendedOrgs },
      { name: 'Cancelled', value: cancelledOrgs },
    ],
    monthlyGrowth,
    recentOrgs,
  }
}

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  TRIAL: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  SUSPENDED: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  CANCELLED: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
  PAST_DUE: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
}

type OrgRow = {
  id: string
  name: string
  slug: string
  status: string
  plan: string
  createdAt: Date
}

export default async function SuperAdminDashboardPage() {
  const session = await getSuperAdminSession()
  if (!session) redirect('/super-admin/login')

  const data = await getDirectData()

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Platform Dashboard</h1>
          <p className="text-muted-foreground mt-0.5 text-sm">
            Overview of all tenant organizations
          </p>
        </div>
        <Button asChild size="sm" className="gap-1.5">
          <Link href="/super-admin/organizations/new">
            <Plus className="h-4 w-4" />
            New Organization
          </Link>
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard
          label="Total Organizations"
          value={data.kpis.totalOrgs}
          icon={Building2}
          iconColor="text-blue-600"
        />
        <KPICard
          label="Active"
          value={data.kpis.activeOrgs}
          icon={TrendingUp}
          iconColor="text-green-600"
        />
        <KPICard
          label="On Trial"
          value={data.kpis.trialOrgs}
          icon={Users}
          iconColor="text-yellow-600"
        />
        <KPICard
          label="New This Month"
          value={data.kpis.newThisMonth}
          trend={data.kpis.signupTrend}
          trendLabel="vs last month"
          icon={Activity}
          iconColor="text-accent"
        />
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <BarChartCard
            title="Monthly Signups"
            description="New organizations per month (last 6 months)"
            data={data.monthlyGrowth}
            bars={[{ key: 'count', label: 'New Orgs', color: '#0369A1' }]}
          />
        </div>
        <DonutChartCard
          title="By Status"
          data={data.statusDist.map((s, i) => ({
            name: s.name,
            value: s.value,
            color: ['#22C55E', '#F59E0B', '#EF4444', '#94A3B8'][i],
          }))}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <DonutChartCard
          title="By Plan"
          data={data.planDistribution.map((p, i) => ({
            name: p.name,
            value: p.value,
            color: ['#0F172A', '#0369A1', '#22C55E', '#F59E0B'][i % 4],
          }))}
        />
        <div className="lg:col-span-2">
          <DataTableWidget
            title="Recent Organizations"
            columns={[
              { key: 'name', label: 'Name' },
              { key: 'slug', label: 'Slug' },
              {
                key: 'status',
                label: 'Status',
                render: (row: OrgRow) => (
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[row.status] ?? ''}`}
                  >
                    {row.status}
                  </span>
                ),
              },
              {
                key: 'plan',
                label: 'Plan',
                render: (row: OrgRow) => <Badge variant="outline">{row.plan}</Badge>,
              },
              {
                key: 'createdAt',
                label: 'Created',
                render: (row: OrgRow) => (
                  <span className="font-mono text-xs">
                    {format(new Date(row.createdAt), 'dd MMM yyyy')}
                  </span>
                ),
              },
            ]}
            data={data.recentOrgs as OrgRow[]}
          />
        </div>
      </div>

      {data.kpis.suspendedOrgs > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900/30 dark:bg-red-950/20">
          <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />
          <p className="text-sm">
            <strong>{data.kpis.suspendedOrgs} organization(s)</strong> are suspended.{' '}
            <Link
              href="/super-admin/organizations?status=SUSPENDED"
              className="font-medium underline"
            >
              View them
            </Link>
          </p>
        </div>
      )}
    </div>
  )
}
