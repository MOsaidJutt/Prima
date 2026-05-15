import { redirect } from 'next/navigation'
import { getTenantSession } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { FileText, PlusCircle, TrendingUp, CheckCircle2, Clock, XCircle } from 'lucide-react'
import { format, startOfMonth, endOfMonth } from 'date-fns'

export default async function SalesRepDashboard() {
  const session = await getTenantSession()
  if (!session) redirect('/login')

  const userId = session.userId
  const orgId = session.organizationId
  const now = new Date()
  const monthStart = startOfMonth(now)
  const monthEnd = endOfMonth(now)

  const [dsrCounts, monthlyRevenue, recentDSRs, targets] = await Promise.all([
    prisma.dSREntry.groupBy({
      by: ['status'],
      where: { organizationId: orgId, submittedById: userId, deletedAt: null },
      _count: true,
    }),
    prisma.invoice.aggregate({
      where: {
        organizationId: orgId,
        createdById: userId,
        issueDate: { gte: monthStart, lte: monthEnd },
        status: { in: ['ISSUED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE'] },
        deletedAt: null,
      },
      _sum: { grandTotal: true },
    }),
    prisma.dSREntry.findMany({
      where: { organizationId: orgId, submittedById: userId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: { client: { select: { companyName: true } } },
    }),
    prisma.salesTarget.findMany({
      where: {
        organizationId: orgId,
        userId,
        isActive: true,
        deletedAt: null,
        periodStart: { lte: now },
        periodEnd: { gte: now },
      },
      take: 3,
    }),
  ])

  const countByStatus = Object.fromEntries(dsrCounts.map((g) => [g.status, g._count]))
  const totalDSRs = dsrCounts.reduce((s, g) => s + g._count, 0)
  const revenue = Number(monthlyRevenue._sum.grandTotal ?? 0)

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      DRAFT: 'secondary',
      SUBMITTED: 'outline',
      APPROVED: 'default',
      REJECTED: 'destructive',
    }
    return map[status] ?? 'secondary'
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">My Dashboard</h1>
          <p className="text-muted-foreground">{format(now, 'EEEE, MMMM d, yyyy')}</p>
        </div>
        <Button asChild>
          <Link href="/dashboard/dsr/new">
            <PlusCircle className="mr-2 h-4 w-4" />
            New DSR
          </Link>
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-muted-foreground text-sm font-medium">Total DSRs</CardTitle>
            <FileText className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalDSRs}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-muted-foreground text-sm font-medium">Approved</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">
              {countByStatus['APPROVED'] ?? 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-muted-foreground text-sm font-medium">
              Pending Approval
            </CardTitle>
            <Clock className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-amber-600">
              {countByStatus['SUBMITTED'] ?? 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-muted-foreground text-sm font-medium">
              This Month Revenue
            </CardTitle>
            <TrendingUp className="text-accent h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">PKR {revenue.toLocaleString('en-PK')}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent DSRs */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent DSRs</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/dashboard/dsr">View all</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {recentDSRs.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No DSRs yet.{' '}
                <Link href="/dashboard/dsr/new" className="text-accent hover:underline">
                  Submit your first one.
                </Link>
              </p>
            ) : (
              <div className="space-y-3">
                {recentDSRs.map((dsr) => (
                  <Link
                    key={dsr.id}
                    href={`/dashboard/dsr/${dsr.id}`}
                    className="hover:bg-muted/40 flex items-center justify-between rounded-lg border p-3 transition-colors"
                  >
                    <div>
                      <p className="text-sm font-medium">{dsr.client.companyName}</p>
                      <p className="text-muted-foreground text-xs">
                        {format(dsr.reportDate, 'MMM d, yyyy')}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-sm">
                        PKR {Number(dsr.grandTotal).toLocaleString('en-PK')}
                      </span>
                      <Badge
                        variant={
                          statusBadge(dsr.status) as
                            | 'default'
                            | 'secondary'
                            | 'outline'
                            | 'destructive'
                        }
                      >
                        {dsr.status}
                      </Badge>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Targets */}
        <Card>
          <CardHeader>
            <CardTitle>My Targets</CardTitle>
          </CardHeader>
          <CardContent>
            {targets.length === 0 ? (
              <p className="text-muted-foreground text-sm">No active targets assigned.</p>
            ) : (
              <div className="space-y-4">
                {targets.map((t) => {
                  const pct = Math.min(
                    100,
                    Math.round((Number(t.achievedValue) / Number(t.targetValue)) * 100)
                  )
                  return (
                    <div key={t.id} className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium">{t.name}</span>
                        <span className="text-muted-foreground">{pct}%</span>
                      </div>
                      <div className="bg-muted h-2 rounded-full">
                        <div
                          className="bg-accent h-2 rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="text-muted-foreground flex justify-between text-xs">
                        <span>PKR {Number(t.achievedValue).toLocaleString('en-PK')} achieved</span>
                        <span>PKR {Number(t.targetValue).toLocaleString('en-PK')} target</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
