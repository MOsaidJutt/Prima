import { cn } from '@/lib/utils'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface LeaderboardEntry {
  rank: number
  id: string
  name: string
  avatar?: string | null
  value: number
  valueLabel?: string
  trend?: number
  subtitle?: string
}

interface LeaderboardProps {
  title: string
  description?: string
  entries: LeaderboardEntry[]
  valuePrefix?: string
  valueSuffix?: string
  className?: string
  loading?: boolean
}

const RANK_COLORS = ['text-yellow-500', 'text-slate-400', 'text-amber-600']

function initials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export function Leaderboard({
  title,
  description,
  entries,
  valuePrefix = '',
  valueSuffix = '',
  className,
  loading,
}: LeaderboardProps) {
  if (loading) {
    return (
      <div className={cn('bg-card border-border rounded-lg border p-5 shadow-sm', className)}>
        <div className="mb-4">
          <div className="bg-muted h-4 w-32 animate-pulse rounded" />
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 py-2.5">
            <div className="bg-muted h-5 w-5 animate-pulse rounded" />
            <div className="bg-muted h-8 w-8 animate-pulse rounded-full" />
            <div className="flex-1">
              <div className="bg-muted h-3.5 w-28 animate-pulse rounded" />
              <div className="bg-muted mt-1 h-2.5 w-16 animate-pulse rounded" />
            </div>
            <div className="bg-muted h-4 w-16 animate-pulse rounded" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className={cn('bg-card border-border rounded-lg border p-5 shadow-sm', className)}>
      <div className="mb-4">
        <h3 className="text-sm font-semibold">{title}</h3>
        {description && <p className="text-muted-foreground mt-0.5 text-xs">{description}</p>}
      </div>

      <div className="space-y-0.5">
        {entries.map((entry) => (
          <div
            key={entry.id}
            className="hover:bg-muted/40 flex items-center gap-3 rounded-md px-2 py-2.5 transition-colors"
          >
            <span
              className={cn(
                'w-5 text-center text-sm font-bold',
                entry.rank <= 3 ? RANK_COLORS[entry.rank - 1] : 'text-muted-foreground'
              )}
            >
              {entry.rank}
            </span>

            <div className="bg-accent/10 text-accent flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
              {entry.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={entry.avatar}
                  alt={entry.name}
                  className="h-8 w-8 rounded-full object-cover"
                />
              ) : (
                initials(entry.name)
              )}
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{entry.name}</p>
              {entry.subtitle && (
                <p className="text-muted-foreground truncate text-xs">{entry.subtitle}</p>
              )}
            </div>

            <div className="flex flex-col items-end gap-0.5">
              <span className="font-mono text-sm font-semibold">
                {valuePrefix}
                {entry.value.toLocaleString()}
                {valueSuffix}
              </span>
              {entry.trend !== undefined && (
                <div className="flex items-center gap-0.5">
                  {entry.trend > 0 && <TrendingUp className="h-3 w-3 text-green-500" />}
                  {entry.trend < 0 && <TrendingDown className="h-3 w-3 text-red-500" />}
                  {entry.trend === 0 && <Minus className="h-3 w-3 text-gray-400" />}
                  <span
                    className={cn(
                      'text-xs',
                      entry.trend > 0 && 'text-green-600',
                      entry.trend < 0 && 'text-red-600',
                      entry.trend === 0 && 'text-muted-foreground'
                    )}
                  >
                    {entry.trend > 0 ? '+' : ''}
                    {entry.trend.toFixed(1)}%
                  </span>
                </div>
              )}
            </div>
          </div>
        ))}

        {entries.length === 0 && (
          <p className="text-muted-foreground py-6 text-center text-sm">No data yet</p>
        )}
      </div>
    </div>
  )
}
