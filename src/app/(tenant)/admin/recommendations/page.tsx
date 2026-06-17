'use client'

import { useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertTriangle,
  BadgeCheck,
  Brain,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Info,
  Loader2,
  X,
  Zap,
} from 'lucide-react'
import { format } from 'date-fns'

interface Recommendation {
  id: string
  type: string
  severity: 'INFO' | 'WARNING' | 'CRITICAL'
  status: 'ACTIVE' | 'ACKNOWLEDGED' | 'DISMISSED' | 'ACTED_ON'
  title: string
  body: string
  createdAt: string
  entityType: string | null
  entityId: string | null
}

const TYPE_LABELS: Record<string, string> = {
  DORMANT_CLIENT: 'Dormant Client',
  INVENTORY_REORDER: 'Reorder Needed',
  ANOMALY_REVENUE: 'Revenue Anomaly',
  ANOMALY_DSR_SKIP: 'DSR Skipped',
  ANOMALY_VELOCITY: 'Velocity Change',
  ANOMALY_ORDER_SPIKE: 'Order Spike',
  PAYMENT_RISK: 'Payment Risk',
  UPSELL: 'Upsell Opportunity',
  TARGET_SUGGESTION: 'Target Suggestion',
}

const SEVERITY_CONFIG = {
  INFO: { label: 'Info', icon: Info, className: 'text-blue-600 bg-blue-500/10' },
  WARNING: { label: 'Warning', icon: AlertTriangle, className: 'text-yellow-600 bg-yellow-500/10' },
  CRITICAL: { label: 'Critical', icon: Zap, className: 'text-destructive bg-destructive/10' },
}

export default function RecommendationsPage() {
  const [recs, setRecs] = useState<Recommendation[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('ACTIVE')
  const [typeFilter, setTypeFilter] = useState('all')
  const [severityFilter, setSeverityFilter] = useState('all')
  const [actingId, setActingId] = useState<string | null>(null)

  const totalPages = Math.ceil(total / 20)

  // No synchronous setState — `loading` starts true and the effect below
  // refetches when filters change (react-hooks/set-state-in-effect).
  const load = useCallback(() => {
    const params = new URLSearchParams({
      status: statusFilter,
      page: String(page),
      limit: '20',
    })
    if (typeFilter !== 'all') params.set('type', typeFilter)
    if (severityFilter !== 'all') params.set('severity', severityFilter)

    fetch(`/api/v1/ai/recommendations?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setRecs(data.recommendations ?? [])
        setTotal(data.total ?? 0)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [statusFilter, typeFilter, severityFilter, page])

  useEffect(() => {
    load()
  }, [load])

  async function act(id: string, action: 'acknowledge' | 'dismiss' | 'act_on') {
    setActingId(id)
    try {
      const res = await fetch(`/api/v1/ai/recommendations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      if (!res.ok) throw new Error('Failed')
      toast.success('Recommendation updated')
      setRecs((prev) => prev.filter((r) => r.id !== id))
      setTotal((t) => t - 1)
    } catch {
      toast.error('Action failed')
    } finally {
      setActingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="bg-primary/10 flex h-10 w-10 items-center justify-center rounded-xl">
          <Brain className="text-primary h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">AI Recommendations</h1>
          <p className="text-muted-foreground text-sm">
            {total} active recommendation{total !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <Select
          value={statusFilter}
          onValueChange={(v) => {
            setStatusFilter(v)
            setPage(1)
          }}
        >
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="ACKNOWLEDGED">Acknowledged</SelectItem>
            <SelectItem value="ACTED_ON">Acted On</SelectItem>
            <SelectItem value="DISMISSED">Dismissed</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={typeFilter}
          onValueChange={(v) => {
            setTypeFilter(v)
            setPage(1)
          }}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {Object.entries(TYPE_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={severityFilter}
          onValueChange={(v) => {
            setSeverityFilter(v)
            setPage(1)
          }}
        >
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Severity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Severity</SelectItem>
            <SelectItem value="CRITICAL">Critical</SelectItem>
            <SelectItem value="WARNING">Warning</SelectItem>
            <SelectItem value="INFO">Info</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
        </div>
      ) : recs.length === 0 ? (
        <div className="flex h-40 flex-col items-center justify-center gap-2 rounded-xl border border-dashed">
          <CheckCircle className="text-muted-foreground/40 h-8 w-8" />
          <p className="text-muted-foreground text-sm">No recommendations in this filter.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {recs.map((rec) => {
            const sev = SEVERITY_CONFIG[rec.severity]
            const SevIcon = sev.icon
            return (
              <Card key={rec.id} className="hover:bg-muted/20 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div
                      className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${sev.className}`}
                    >
                      <SevIcon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium">{rec.title}</p>
                        <Badge variant="outline" className="text-xs">
                          {TYPE_LABELS[rec.type] ?? rec.type}
                        </Badge>
                        <Badge variant="outline" className={`text-xs ${sev.className}`}>
                          {sev.label}
                        </Badge>
                      </div>
                      <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
                        {rec.body}
                      </p>
                      <p className="text-muted-foreground/60 mt-1.5 text-xs">
                        {format(new Date(rec.createdAt), 'MMM d, yyyy HH:mm')}
                      </p>
                    </div>

                    {rec.status === 'ACTIVE' && (
                      <div className="flex shrink-0 gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          disabled={actingId === rec.id}
                          onClick={() => act(rec.id, 'acknowledge')}
                        >
                          {actingId === rec.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <BadgeCheck className="h-3 w-3" />
                          )}
                          <span className="ml-1 hidden sm:inline">Ack</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="default"
                          className="h-7 text-xs"
                          disabled={actingId === rec.id}
                          onClick={() => act(rec.id, 'act_on')}
                        >
                          <CheckCircle className="h-3 w-3" />
                          <span className="ml-1 hidden sm:inline">Done</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-muted-foreground hover:text-destructive h-7 w-7"
                          disabled={actingId === rec.id}
                          onClick={() => act(rec.id, 'dismiss')}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="icon"
            aria-label="Previous page"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-muted-foreground text-sm">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="icon"
            aria-label="Next page"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  )
}
