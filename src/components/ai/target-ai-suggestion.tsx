'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, Brain, Loader2, TrendingUp } from 'lucide-react'
import { toast } from 'sonner'

interface TargetAISuggestionProps {
  scope: string
  type: string
  period: string
  userId?: string
  departmentId?: string
  productId?: string
  clientId?: string
  proposedTarget?: number
  onAccept?: (value: number) => void
}

interface Suggestion {
  suggested: number | null
  rationale: string
  warning: string | null
  history: Array<{ month: string; value: number }>
}

export function TargetAISuggestion({
  scope,
  type,
  period,
  userId,
  departmentId,
  productId,
  clientId,
  proposedTarget,
  onAccept,
}: TargetAISuggestionProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null)

  async function fetchSuggestion() {
    setLoading(true)
    try {
      const res = await fetch('/api/v1/ai/target-suggestion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scope,
          type,
          period,
          userId,
          departmentId,
          productId,
          clientId,
          proposedTarget,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? 'Failed')
      }
      const data = await res.json()
      setSuggestion(data)
      setOpen(true)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'AI suggestion failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={fetchSuggestion}
        disabled={loading}
        className="gap-1.5"
      >
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Brain className="text-primary h-3.5 w-3.5" />
        )}
        Get AI Suggestion
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Brain className="text-primary h-4 w-4" />
              AI Target Suggestion
            </DialogTitle>
            <DialogDescription>Based on historical performance data.</DialogDescription>
          </DialogHeader>

          {suggestion && (
            <div className="space-y-4">
              {/* Historical trend */}
              {suggestion.history.length > 0 && (
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-muted-foreground mb-2 text-xs font-medium">HISTORICAL TREND</p>
                  <div className="space-y-1">
                    {suggestion.history.map((h) => (
                      <div key={h.month} className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{h.month}</span>
                        <span className="font-mono font-medium">
                          {h.value.toLocaleString('en-PK')}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Suggested target */}
              {suggestion.suggested !== null && (
                <div className="bg-primary/5 rounded-lg border p-4 text-center">
                  <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                    Suggested Target
                  </p>
                  <p className="text-primary mt-1 font-mono text-3xl font-bold">
                    {suggestion.suggested.toLocaleString('en-PK')}
                  </p>
                  <Badge variant="outline" className="mt-1 text-xs">
                    <TrendingUp className="mr-1 h-3 w-3" />
                    {type}
                  </Badge>
                </div>
              )}

              {/* Rationale */}
              <p className="text-muted-foreground text-sm leading-relaxed">
                {suggestion.rationale}
              </p>

              {/* Warning */}
              {suggestion.warning && (
                <div className="flex gap-2 rounded-lg bg-yellow-500/10 p-3">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-yellow-600" />
                  <p className="text-sm text-yellow-700">{suggestion.warning}</p>
                </div>
              )}

              {/* Actions */}
              {suggestion.suggested !== null && onAccept && (
                <div className="flex justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
                    Ignore
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      onAccept(suggestion.suggested!)
                      setOpen(false)
                      toast.success('Target value applied')
                    }}
                  >
                    Use This Target
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
