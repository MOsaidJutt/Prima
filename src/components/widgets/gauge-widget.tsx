'use client'

import { cn } from '@/lib/utils'

interface GaugeWidgetProps {
  title: string
  description?: string
  value: number // actual value
  target: number // target value
  prefix?: string
  suffix?: string
  className?: string
  loading?: boolean
}

export function GaugeWidget({
  title,
  description,
  value,
  target,
  prefix = '',
  suffix = '',
  className,
  loading,
}: GaugeWidgetProps) {
  const pct = target > 0 ? Math.min((value / target) * 100, 100) : 0
  const color = pct >= 100 ? '#22C55E' : pct >= 75 ? '#0369A1' : pct >= 50 ? '#F59E0B' : '#EF4444'

  const radius = 54
  const circumference = 2 * Math.PI * radius
  // Show only top 180° arc
  const arcLength = circumference * 0.5
  const offset = arcLength - (pct / 100) * arcLength

  if (loading) {
    return (
      <div className={cn('bg-card border-border rounded-lg border p-5 shadow-sm', className)}>
        <div className="bg-muted mb-4 h-4 w-28 animate-pulse rounded" />
        <div className="bg-muted mx-auto h-32 w-32 animate-pulse rounded-full" />
      </div>
    )
  }

  return (
    <div className={cn('bg-card border-border rounded-lg border p-5 shadow-sm', className)}>
      <div className="mb-3">
        <h3 className="text-sm font-semibold">{title}</h3>
        {description && <p className="text-muted-foreground mt-0.5 text-xs">{description}</p>}
      </div>

      <div className="flex flex-col items-center">
        <div className="relative">
          <svg width="140" height="80" viewBox="0 0 140 80">
            {/* Background arc */}
            <path
              d="M 10 70 A 60 60 0 0 1 130 70"
              fill="none"
              stroke="hsl(var(--muted))"
              strokeWidth="12"
              strokeLinecap="round"
            />
            {/* Value arc */}
            <path
              d="M 10 70 A 60 60 0 0 1 130 70"
              fill="none"
              stroke={color}
              strokeWidth="12"
              strokeLinecap="round"
              strokeDasharray={`${(pct / 100) * Math.PI * 60} ${Math.PI * 60}`}
              style={{ transition: 'stroke-dasharray 0.6s ease' }}
            />
            <text
              x="70"
              y="65"
              textAnchor="middle"
              fontSize="20"
              fontWeight="700"
              fill="currentColor"
              className="fill-foreground font-mono"
            >
              {Math.round(pct)}%
            </text>
          </svg>
        </div>

        <div className="mt-1 grid grid-cols-2 gap-4 text-center">
          <div>
            <p className="font-mono text-base font-bold">
              {prefix}
              {value.toLocaleString()}
              {suffix}
            </p>
            <p className="text-muted-foreground text-xs">Achieved</p>
          </div>
          <div>
            <p className="font-mono text-base font-bold">
              {prefix}
              {target.toLocaleString()}
              {suffix}
            </p>
            <p className="text-muted-foreground text-xs">Target</p>
          </div>
        </div>
      </div>
    </div>
  )
}
