import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Building2, Users, Package } from 'lucide-react'
import Link from 'next/link'

interface EntityCardProps {
  type: 'distributor' | 'client' | 'product'
  id: string
  name: string
  code?: string
  subtitle?: string
  badge?: { label: string; variant?: 'default' | 'secondary' | 'destructive' | 'outline' }
  meta?: Array<{ label: string; value: string }>
  className?: string
}

export function EntityCard({
  type,
  id,
  name,
  code,
  subtitle,
  badge,
  meta,
  className,
}: EntityCardProps) {
  const Icon = type === 'distributor' ? Building2 : type === 'client' ? Users : Package

  const href =
    type === 'distributor'
      ? `/admin/distributors/${id}`
      : type === 'client'
        ? `/admin/clients/${id}`
        : `/admin/products/${id}`

  return (
    <Link
      href={href}
      className={cn(
        'bg-card hover:border-primary/40 flex items-start gap-3 rounded-lg border p-4 transition-colors',
        className
      )}
    >
      <div className="bg-primary/10 text-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate font-medium">{name}</p>
            {code && <p className="text-muted-foreground font-mono text-xs">{code}</p>}
            {subtitle && (
              <p className="text-muted-foreground mt-0.5 truncate text-sm">{subtitle}</p>
            )}
          </div>
          {badge && (
            <Badge variant={badge.variant ?? 'secondary'} className="shrink-0 text-xs">
              {badge.label}
            </Badge>
          )}
        </div>
        {meta && meta.length > 0 && (
          <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
            {meta.map((m) => (
              <div key={m.label}>
                <dt className="text-muted-foreground text-xs">{m.label}</dt>
                <dd className="text-sm font-medium">{m.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </Link>
  )
}
