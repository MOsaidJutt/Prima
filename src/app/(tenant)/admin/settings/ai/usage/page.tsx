'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { Loader2, Zap, TrendingUp, DollarSign, Clock } from 'lucide-react'

interface UsageData {
  budget: number
  used: number
  remaining: number
  percentUsed: number
  daysRemainingEstimate: number
  byFeature: Array<{ feature: string; tokens: number; costUsd: number }>
  byUser: Array<{
    userId: string
    user: { name: string; email: string } | null
    tokens: number
    costUsd: number
  }>
  dailyChart: Array<{ date: string; tokens: number; cost: number }>
}

const FEATURE_LABELS: Record<string, string> = {
  chat: 'AI Chat',
  summary: 'Summaries',
  prediction: 'Predictions',
  scoring: 'Scoring',
  anomaly: 'Anomaly Detection',
  embedding: 'Embeddings',
}

export default function AIUsagePage() {
  const [data, setData] = useState<UsageData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/v1/ai/usage')
      .then((r) => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
      </div>
    )
  }

  if (!data) return <p className="text-muted-foreground">No usage data available.</p>

  const budgetColor =
    data.percentUsed >= 90
      ? 'text-destructive'
      : data.percentUsed >= 70
        ? 'text-yellow-600'
        : 'text-green-600'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">AI Usage</h1>
        <p className="text-muted-foreground text-sm">
          Monthly token consumption and cost breakdown.
        </p>
      </div>

      {/* KPI row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 flex h-9 w-9 items-center justify-center rounded-lg">
                <Zap className="text-primary h-4 w-4" />
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Used This Month</p>
                <p className="text-xl font-bold">{data.used.toLocaleString()}</p>
                <p className="text-muted-foreground text-xs">tokens</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="bg-muted flex h-9 w-9 items-center justify-center rounded-lg">
                <TrendingUp className="text-muted-foreground h-4 w-4" />
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Budget Used</p>
                <p className={`text-xl font-bold ${budgetColor}`}>{data.percentUsed}%</p>
                <p className="text-muted-foreground text-xs">of {data.budget.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-500/10">
                <DollarSign className="h-4 w-4 text-green-600" />
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Est. Cost</p>
                <p className="text-xl font-bold">
                  ${data.byFeature.reduce((s, f) => s + f.costUsd, 0).toFixed(2)}
                </p>
                <p className="text-muted-foreground text-xs">this month</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/10">
                <Clock className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Days Remaining</p>
                <p className="text-xl font-bold">{data.daysRemainingEstimate}</p>
                <p className="text-muted-foreground text-xs">at current rate</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Budget progress */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Budget Progress</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between text-sm">
            <span>{data.used.toLocaleString()} used</span>
            <span className="text-muted-foreground">{data.budget.toLocaleString()} budget</span>
          </div>
          <Progress value={data.percentUsed} className="h-3" />
          {data.percentUsed >= 80 && (
            <p className="text-xs text-yellow-600">
              ⚠ You have used {data.percentUsed}% of your token budget. Consider topping up.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Daily chart */}
      {data.dailyChart.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Daily Token Usage (Last 30 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={data.dailyChart}>
                <defs>
                  <linearGradient id="tokenGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0369A1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#0369A1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v) => v.slice(5)} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(v) => [typeof v === 'number' ? v.toLocaleString() : v, 'Tokens']}
                />
                <Area
                  type="monotone"
                  dataKey="tokens"
                  stroke="#0369A1"
                  fill="url(#tokenGrad)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* By feature */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Usage by Feature</CardTitle>
          </CardHeader>
          <CardContent>
            {data.byFeature.length === 0 ? (
              <p className="text-muted-foreground text-sm">No usage recorded yet.</p>
            ) : (
              <div className="space-y-3">
                {data.byFeature.map((f) => (
                  <div key={f.feature} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{FEATURE_LABELS[f.feature] ?? f.feature}</Badge>
                    </div>
                    <div className="text-right text-sm">
                      <p className="font-medium">{f.tokens.toLocaleString()} tokens</p>
                      <p className="text-muted-foreground text-xs">${f.costUsd.toFixed(4)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* By user */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Usage by User</CardTitle>
          </CardHeader>
          <CardContent>
            {data.byUser.length === 0 ? (
              <p className="text-muted-foreground text-sm">No user usage recorded yet.</p>
            ) : (
              <div className="space-y-3">
                {data.byUser.map((u) => (
                  <div key={u.userId} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{u.user?.name ?? 'System'}</p>
                      <p className="text-muted-foreground text-xs">{u.user?.email ?? ''}</p>
                    </div>
                    <div className="text-right text-sm">
                      <p className="font-medium">{u.tokens.toLocaleString()} tokens</p>
                      <p className="text-muted-foreground text-xs">${u.costUsd.toFixed(4)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
