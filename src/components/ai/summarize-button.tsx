'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Brain, Loader2, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'

interface SummarizeButtonProps {
  widgetKey: string
  widgetTitle: string
  data: Record<string, unknown>
  className?: string
}

export function SummarizeButton({ widgetKey, widgetTitle, data, className }: SummarizeButtonProps) {
  const [loading, setLoading] = useState(false)
  const [summary, setSummary] = useState<string | null>(null)
  const [cached, setCached] = useState(false)
  const [open, setOpen] = useState(false)

  async function fetchSummary() {
    setLoading(true)
    try {
      const res = await fetch('/api/v1/ai/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ widgetKey, widgetTitle, data }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? 'Failed to generate summary')
      }
      const result = await res.json()
      setSummary(result.summary)
      setCached(result.cached)
      setOpen(true)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'AI summary failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={`text-muted-foreground hover:text-foreground h-7 gap-1.5 text-xs ${className ?? ''}`}
          onClick={!summary ? fetchSummary : undefined}
          disabled={loading}
        >
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Brain className="h-3 w-3" />}
          {loading ? 'Analyzing...' : 'Summarize'}
        </Button>
      </PopoverTrigger>
      {summary && (
        <PopoverContent className="w-72 text-sm" side="bottom" align="end">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-primary flex items-center gap-1.5 text-xs font-medium">
                <Brain className="h-3.5 w-3.5" />
                AI Summary
              </div>
              <button
                onClick={() => {
                  setSummary(null)
                  fetchSummary()
                }}
                className="text-muted-foreground hover:text-foreground"
                title="Refresh summary"
              >
                <RefreshCw className="h-3 w-3" />
              </button>
            </div>
            <p className="text-muted-foreground leading-relaxed">{summary}</p>
            {cached && <p className="text-muted-foreground/60 text-xs">Cached summary</p>}
          </div>
        </PopoverContent>
      )}
    </Popover>
  )
}
