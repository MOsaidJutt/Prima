import { redirect } from 'next/navigation'
import { getTenantSession } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Clock, CheckCircle2, XCircle, Users, TrendingUp } from 'lucide-react'
import { format, startOfMonth, endOfMonth } from 'date-fns'

export default async function ManagerDashboard() {
  const session = await getTenantSession()
  if (!session) redirect('/login')

  const orgId = session.organizationId
  const now = new Date()

  const [pending, teamRevenue, topReps, recentActivity] = await Promise.all([
    prisma.dSREntry.count({
      where: { organizationId: orgId, status: 'SUBMITTED', deletedAt: null },
    }),
    prisma.invoice.aggregate({
      where: {
        organizationId: orgId,
        issueDate: { gte: startOfMonth(now), lte: endOfMonth(now) },
        status: { in: ['ISSUED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE'] },
        deletedAt: null,
      },
      _sum: { grandTotal: true },
    }),
    prisma.dSREntry.groupBy({
      by: ['submittedById'],
      where: {
        organizationId: orgId,
        status: 'APPROVED',
        deletedAt: null,
        reportDate: { gte: startOfMonth(now) },
      },
      _count: true,
      orderBy: { _count: { submittedById: 'desc' } },
      take: 5,
    }),
    prisma.dSREntry.findMany({
      where: { organizationId: orgId, status: 'SUBMITTED', deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        client: { select: { companyName: true } },
        submittedBy: { select: { name: true } },
      },
    }),
  ])

  // Enrich topReps with user names
  const repIds = topReps.map((r) => r.submittedById)
  const repUsers = await prisma.user.findMany({
    where: { id: { in: repIds } },
    select: { id: true, name: true },
  })
  const repMap = Object.fromEntries(repUsers.map((u) => [u.id, u.name]))

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Manager Dashboard</h1>
        <p className="text-muted-foreground">{format(now, 'EEEE, MMMM d, yyyy')}</p>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-muted-foreground text-sm font-medium">
              Awaiting Approval
            </CardTitle>
            <Clock className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-amber-600">{pending}</div>
            {pending > 0 && (
              <Button asChild size="sm" variant="link" className="mt-1 px-0">
                <Link href="/manager/dsr/pending">Review now →</Link>
              </Button>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-muted-foreground text-sm font-medium">
              Month Revenue
            </CardTitle>
            <TrendingUp className="text-accent h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              PKR {Number(teamRevenue._sum.grandTotal ?? 0).toLocaleString('en-PK')}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-muted-foreground text-sm font-medium">
              Top Reps (Month)
            </CardTitle>
            <Users className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {topReps.slice(0, 3).map((r, i) => (
                <div key={r.submittedById} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    #{i + 1} {repMap[r.submittedById] ?? 'Unknown'}
                  </span>
                  <span className="font-mono font-medium">{r._count} DSRs</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pending Approvals */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Pending Approvals</CardTitle>
          <Button variant="outline" size="sm" asChild>
            <Link href="/manager/dsr/pending">View all</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {recentActivity.length === 0 ? (
            <p className="text-muted-foreground text-sm">No DSRs awaiting approval.</p>
          ) : (
            <div className="space-y-2">
              {recentActivity.map((dsr) => (
                <Link
                  key={dsr.id}
                  href={`/manager/dsr/${dsr.id}`}
                  className="hover:bg-muted/40 flex items-center justify-between rounded-lg border p-3 transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium">{dsr.submittedBy.name}</p>
                    <p className="text-muted-foreground text-xs">
                      {dsr.client.companyName} · {format(dsr.reportDate, 'MMM d')}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm">
                      PKR {Number(dsr.grandTotal).toLocaleString('en-PK')}
                    </span>
                    <Badge variant="outline">Review</Badge>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
