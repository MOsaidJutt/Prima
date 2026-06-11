import { getRevenueStats } from '@/lib/billing/revenue'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { MrrTrendChart, CohortRetentionChart } from './revenue-charts'

export const metadata = { title: 'Revenue' }

function formatPkr(n: number): string {
  return `Rs ${Math.round(n).toLocaleString()}`
}

function formatPct(n: number): string {
  return `${(n * 100).toFixed(1)}%`
}

export default async function RevenuePage() {
  const stats = await getRevenueStats()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Revenue</h1>
        <p className="text-muted-foreground">
          Platform-wide subscription revenue, retention, and growth metrics
        </p>
      </div>

      {/* Headline KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-muted-foreground text-sm font-medium">MRR</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{formatPkr(stats.mrr)}</p>
            <p className="text-muted-foreground text-xs">Monthly recurring revenue</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-muted-foreground text-sm font-medium">ARR</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{formatPkr(stats.arr)}</p>
            <p className="text-muted-foreground text-xs">Annual run rate</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-muted-foreground text-sm font-medium">
              Active Subscriptions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stats.activeSubscriptions}</p>
            <p className="text-muted-foreground text-xs">Paying organizations</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-muted-foreground text-sm font-medium">
              Estimated LTV
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {stats.ltvEstimate !== null ? formatPkr(stats.ltvEstimate) : '—'}
            </p>
            <p className="text-muted-foreground text-xs">Avg. revenue per org / churn rate</p>
          </CardContent>
        </Card>
      </div>

      {/* Org status breakdown */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-muted-foreground text-sm font-medium">In Trial</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stats.trialOrgs}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-muted-foreground text-sm font-medium">Past Due</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stats.pastDueOrgs}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-muted-foreground text-sm font-medium">Suspended</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stats.suspendedOrgs}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-muted-foreground text-sm font-medium">Cancelled</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stats.cancelledOrgs}</p>
          </CardContent>
        </Card>
      </div>

      {/* MRR trend */}
      <MrrTrendChart data={stats.mrrTrend} />

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Plan breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Plan Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 sticky top-0 z-10 border-b">
                    <th className="text-muted-foreground px-4 py-2 text-left font-medium">Plan</th>
                    <th className="text-muted-foreground px-4 py-2 text-right font-medium">
                      Organizations
                    </th>
                    <th className="text-muted-foreground px-4 py-2 text-right font-medium">MRR</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.planBreakdown.map((p) => (
                    <tr
                      key={p.plan}
                      className="hover:bg-muted/40 border-b transition-colors last:border-0"
                    >
                      <td className="px-4 py-2 font-medium">{p.plan}</td>
                      <td className="px-4 py-2 text-right">{p.count}</td>
                      <td className="px-4 py-2 text-right">{formatPkr(p.mrr)}</td>
                    </tr>
                  ))}
                  {stats.planBreakdown.length === 0 && (
                    <tr>
                      <td colSpan={3} className="text-muted-foreground px-4 py-6 text-center">
                        No active subscriptions yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Churn + Trial conversion */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Churn (last 30 days)</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground text-xs">Churn rate</p>
                <p className="text-xl font-bold">{formatPct(stats.churn.rate)}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Cancelled</p>
                <p className="text-xl font-bold">{stats.churn.cancelledLast30d}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Base orgs</p>
                <p className="text-xl font-bold">{stats.churn.baseOrgs}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Trial → Paid Conversion</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs">Total trials</p>
                  <p className="text-xl font-bold">{stats.trialConversion.totalTrials}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Converted</p>
                  <p className="text-xl font-bold">{stats.trialConversion.converted}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Still in trial</p>
                  <p className="text-xl font-bold">{stats.trialConversion.stillInTrial}</p>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-sm">Conversion rate</span>
                <Badge variant={stats.trialConversion.rate >= 0.3 ? 'success' : 'warning'}>
                  {formatPct(stats.trialConversion.rate)}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Cohort retention */}
      <CohortRetentionChart data={stats.cohortRetention} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cohort Detail</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 sticky top-0 z-10 border-b">
                  <th className="text-muted-foreground px-4 py-2 text-left font-medium">
                    Signup cohort
                  </th>
                  <th className="text-muted-foreground px-4 py-2 text-right font-medium">
                    Organizations
                  </th>
                  <th className="text-muted-foreground px-4 py-2 text-right font-medium">
                    Still active
                  </th>
                  <th className="text-muted-foreground px-4 py-2 text-right font-medium">
                    Retention
                  </th>
                </tr>
              </thead>
              <tbody>
                {stats.cohortRetention.map((c) => (
                  <tr
                    key={c.cohort}
                    className="hover:bg-muted/40 border-b transition-colors last:border-0"
                  >
                    <td className="px-4 py-2 font-medium">{c.cohort}</td>
                    <td className="px-4 py-2 text-right">{c.size}</td>
                    <td className="px-4 py-2 text-right">{c.retained}</td>
                    <td className="px-4 py-2 text-right">{formatPct(c.retentionRate)}</td>
                  </tr>
                ))}
                {stats.cohortRetention.length === 0 && (
                  <tr>
                    <td colSpan={4} className="text-muted-foreground px-4 py-6 text-center">
                      No signup cohorts yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
