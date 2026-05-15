import { cn } from '@/lib/utils'
import { Sparkles, Lock } from 'lucide-react'

interface AIInsight {
  id: string
  type: 'info' | 'warning' | 'success' | 'danger'
  title: string
  body: string
}

interface AIInsightsCardProps {
  title?: string
  insights?: AIInsight[]
  className?: string
  loading?: boolean
}

const TYPE_STYLES = {
  info: 'border-l-blue-500 bg-blue-50 dark:bg-blue-950/20',
  warning: 'border-l-amber-500 bg-amber-50 dark:bg-amber-950/20',
  success: 'border-l-green-500 bg-green-50 dark:bg-green-950/20',
  danger: 'border-l-red-500 bg-red-50 dark:bg-red-950/20',
}

export function AIInsightsCard({
  title = 'AI Insights',
  insights,
  className,
  loading,
}: AIInsightsCardProps) {
  return (
    <div className={cn('bg-card border-border rounded-lg border p-5 shadow-sm', className)}>
      <div className="mb-4 flex items-center gap-2">
        <Sparkles className="text-accent h-4 w-4" />
        <h3 className="text-sm font-semibold">{title}</h3>
        <span className="bg-muted text-muted-foreground ml-auto rounded-full px-2 py-0.5 text-xs">
          Phase 5
        </span>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-muted h-12 animate-pulse rounded-md" />
          ))}
        </div>
      ) : insights && insights.length > 0 ? (
        <div className="space-y-3">
          {insights.map((insight) => (
            <div
              key={insight.id}
              className={cn('rounded-r-md border-l-4 p-3', TYPE_STYLES[insight.type])}
            >
              <p className="text-sm font-medium">{insight.title}</p>
              <p className="text-muted-foreground mt-0.5 text-xs">{insight.body}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <div className="bg-muted mb-3 rounded-full p-3">
            <Lock className="text-muted-foreground h-5 w-5" />
          </div>
          <p className="text-sm font-medium">AI Insights coming in Phase 5</p>
          <p className="text-muted-foreground mt-1 max-w-[200px] text-xs">
            Demand predictions, dormant clients, anomaly detection and more.
          </p>
        </div>
      )}
    </div>
  )
}
