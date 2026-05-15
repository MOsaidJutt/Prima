import { cn } from '@/lib/utils'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface KPICardProps {
  label: string
  value: string | number
  trend?: number // percentage, positive = up, negative = down
  trendLabel?: string
  icon?: LucideIcon
  iconColor?: string
  prefix?: string
  suffix?: string
  className?: string
  loading?: boolean
}

export function KPICard({
  label,
  value,
  trend,
  trendLabel,
  icon: Icon,
  iconColor = 'text-accent',
  prefix,
  suffix,
  className,
  loading,
}: KPICardProps) {
  if (loading) {
    return (
      <div className={cn('bg-card border-border rounded-lg border p-5 shadow-sm', className)}>
        <div className="mb-3 flex items-center justify-between">
          <div className="bg-muted h-4 w-24 animate-pulse rounded" />
          <div className="bg-muted h-8 w-8 animate-pulse rounded-md" />
        </div>
        <div className="bg-muted h-8 w-32 animate-pulse rounded" />
        <div className="bg-muted mt-2 h-3 w-20 animate-pulse rounded" />
      </div>
    )
  }

  const trendPositive = trend !== undefined && trend > 0
  const trendNegative = trend !== undefined && trend < 0
  const trendNeutral = trend === 0

  return (
    <div
      className={cn(
        'bg-card border-border rounded-lg border p-5 shadow-sm transition-shadow hover:shadow-md',
        className
      )}
    >
      <div className="mb-3 flex items-center justify-between">
        <p className="text-muted-foreground text-sm font-medium">{label}</p>
        {Icon && (
          <div className="bg-muted rounded-md p-1.5">
            <Icon className={cn('h-5 w-5', iconColor)} />
          </div>
        )}
      </div>

      <p className="font-mono text-3xl font-bold tracking-tight">
        {prefix && <span className="text-muted-foreground mr-1 text-xl font-normal">{prefix}</span>}
        {value}
        {suffix && <span className="text-muted-foreground ml-1 text-xl font-normal">{suffix}</span>}
      </p>

      {trend !== undefined && (
        <div className="mt-2 flex items-center gap-1">
          {trendPositive && <TrendingUp className="h-3.5 w-3.5 text-green-500" />}
          {trendNegative && <TrendingDown className="h-3.5 w-3.5 text-red-500" />}
          {trendNeutral && <Minus className="h-3.5 w-3.5 text-gray-400" />}
          <span
            className={cn(
              'text-xs font-medium',
              trendPositive && 'text-green-600 dark:text-green-400',
              trendNegative && 'text-red-600 dark:text-red-400',
              trendNeutral && 'text-muted-foreground'
            )}
          >
            {trendPositive && '+'}
            {trend?.toFixed(1)}%
          </span>
          {trendLabel && <span className="text-muted-foreground text-xs">{trendLabel}</span>}
        </div>
      )}
    </div>
  )
}
