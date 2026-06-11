'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export function MrrTrendChart({ data }: { data: Array<{ month: string; mrr: number }> }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Realized Subscription Revenue (12 months)</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `Rs ${(v / 1000).toFixed(0)}k`} />
            <Tooltip
              formatter={(v) => [`Rs ${typeof v === 'number' ? v.toLocaleString() : v}`, 'Revenue']}
            />
            <Bar dataKey="mrr" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

export function CohortRetentionChart({
  data,
}: {
  data: Array<{ cohort: string; size: number; retained: number; retentionRate: number }>
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Cohort Retention (signup month, current snapshot)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart
            data={data.map((c) => ({ ...c, retentionPct: Math.round(c.retentionRate * 100) }))}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="cohort" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
            <Tooltip
              formatter={(v, name, props) => {
                if (name === 'retentionPct') {
                  const p = props.payload as { retained: number; size: number }
                  return [`${v}% (${p.retained}/${p.size} orgs)`, 'Retention']
                }
                return [v, name]
              }}
            />
            <Bar dataKey="retentionPct" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
