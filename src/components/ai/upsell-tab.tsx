'use client'

import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Brain, Loader2, Package, RefreshCw, ShoppingCart } from 'lucide-react'

interface Product {
  id: string
  name: string
  sku: string
  similarity: number
}

interface UpsellTabProps {
  clientId: string
}

export function UpsellTab({ clientId }: UpsellTabProps) {
  const [loading, setLoading] = useState(true)
  const [suggestions, setSuggestions] = useState<Product[]>([])
  const [rationale, setRationale] = useState<string>('')

  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    fetch(`/api/v1/ai/upsell?clientId=${clientId}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((data) => {
        setSuggestions(data.suggestions ?? [])
        setRationale(data.rationale ?? '')
        setLoading(false)
      })
      .catch((err) => {
        if (err.name !== 'AbortError') setLoading(false)
      })
    return () => controller.abort()
  }, [clientId, refreshKey])

  const load = () => setRefreshKey((k) => k + 1)

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
      </div>
    )
  }

  if (suggestions.length === 0) {
    return (
      <div className="flex h-40 flex-col items-center justify-center gap-2 rounded-xl border border-dashed">
        <Package className="text-muted-foreground/40 h-8 w-8" />
        <p className="text-muted-foreground text-sm">No suggestions available yet.</p>
        <p className="text-muted-foreground/60 text-xs">
          Suggestions improve as the client builds order history.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="text-primary h-4 w-4" />
          <p className="text-sm font-medium">AI-Suggested Products</p>
        </div>
        <Button variant="ghost" size="sm" onClick={load} className="h-7">
          <RefreshCw className="h-3 w-3" />
        </Button>
      </div>

      {rationale && <p className="text-muted-foreground text-sm italic">{rationale}</p>}

      <div className="space-y-2">
        {suggestions.map((p, i) => (
          <Card key={p.id} className="hover:bg-muted/20 transition-colors">
            <CardContent className="flex items-center gap-3 p-3">
              <div className="bg-primary/10 text-primary flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold">
                #{i + 1}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{p.name}</p>
                <p className="text-muted-foreground text-xs">SKU: {p.sku}</p>
              </div>
              {p.similarity > 0 && (
                <Badge variant="outline" className="shrink-0 text-xs">
                  {Math.round(p.similarity * 100)}% match
                </Badge>
              )}
              <Button size="sm" variant="outline" className="h-7 shrink-0">
                <ShoppingCart className="h-3 w-3" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
