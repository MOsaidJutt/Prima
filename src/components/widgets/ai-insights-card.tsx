'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { AlertTriangle, Brain, Loader2, Sparkles, Zap } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

interface AIRecommendation {
  id: string
  type: string
  severity: 'INFO' | 'WARNING' | 'CRITICAL'
  title: string
  body: string
}

interface AIInsightsCardProps {
  className?: string
}

const SEVERITY_ICON = {
  INFO: Brain,
  WARNING: AlertTriangle,
  CRITICAL: Zap,
}

const SEVERITY_STYLE = {
  INFO: 'border-l-blue-500 bg-blue-50 dark:bg-blue-950/20',
  WARNING: 'border-l-amber-500 bg-amber-50 dark:bg-amber-950/20',
  CRITICAL: 'border-l-red-500 bg-red-50 dark:bg-red-950/20',
}

export function AIInsightsCard({ className }: AIInsightsCardProps) {
  const [recs, setRecs] = useState<AIRecommendation[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/v1/ai/recommendations?status=ACTIVE&limit=3')
      .then((r) => r.json())
      .then((d) => setRecs(d.recommendations ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className={cn('bg-card border-border rounded-lg border p-5 shadow-sm', className)}>
      <div className="mb-4 flex items-center gap-2">
        <Sparkles className="text-accent h-4 w-4" />
        <h3 className="text-sm font-semibold">AI Insights</h3>
        <Link href="/admin/recommendations" className="ml-auto">
          <Button variant="ghost" size="sm" className="text-muted-foreground h-6 text-xs">
            View all
          </Button>
        </Link>
      </div>

      {loading ? (
        <div className="flex h-20 items-center justify-center">
          <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
        </div>
      ) : recs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <div className="bg-muted mb-3 rounded-full p-3">
            <Brain className="text-muted-foreground h-5 w-5" />
          </div>
          <p className="text-sm font-medium">No active AI insights</p>
          <p className="text-muted-foreground mt-1 max-w-[200px] text-xs">
            AI will flag anomalies, dormant clients, and reorder recommendations here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {recs.map((rec) => {
            const Icon = SEVERITY_ICON[rec.severity]
            return (
              <div
                key={rec.id}
                className={cn('rounded-r-md border-l-4 p-3', SEVERITY_STYLE[rec.severity])}
              >
                <div className="flex items-center gap-1.5">
                  <Icon className="h-3 w-3 shrink-0" />
                  <p className="text-sm font-medium">{rec.title}</p>
                </div>
                <p className="text-muted-foreground mt-0.5 line-clamp-2 text-xs">{rec.body}</p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
