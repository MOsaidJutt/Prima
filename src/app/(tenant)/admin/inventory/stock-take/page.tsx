'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import Link from 'next/link'
import { ChevronLeft, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'

type Warehouse = { id: string; code: string; name: string }
type ProductStock = { id: string; sku: string; name: string; quantity: number }

export default function StockTakePage() {
  const router = useRouter()
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [warehouseId, setWarehouseId] = useState('')
  const [products, setProducts] = useState<ProductStock[]>([])
  const [counts, setCounts] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [variances, setVariances] = useState<
    Array<{ productId: string; expected: number; counted: number; variance: number }>
  >([])

  useEffect(() => {
    fetch('/api/v1/warehouses')
      .then((r) => r.json())
      .then((d) => setWarehouses(d.warehouses ?? []))
  }, [])

  useEffect(() => {
    if (!warehouseId) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    fetch(`/api/v1/warehouses/${warehouseId}`)
      .then((r) => r.json())
      .then((wh) => {
        const prods: ProductStock[] = (wh.inventoryStock ?? []).map(
          (s: { product: { id: string; sku: string; name: string }; quantity: number }) => ({
            id: s.product.id,
            sku: s.product.sku,
            name: s.product.name,
            quantity: s.quantity,
          })
        )
        setProducts(prods)
        const init: Record<string, string> = {}
        prods.forEach((p) => {
          init[p.id] = String(p.quantity)
        })
        setCounts(init)
      })
      .finally(() => setLoading(false))
  }, [warehouseId])

  async function handleSubmit() {
    if (!warehouseId) return
    const countArray = Object.entries(counts)
      .filter(([id]) => products.some((p) => p.id === id))
      .map(([productId, v]) => ({ productId, countedQuantity: Number(v) || 0 }))

    if (!countArray.length) {
      toast.error('No products to count')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/v1/inventory/stock-take', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ warehouseId, counts: countArray }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setVariances(data.variances.filter((v: { variance: number }) => v.variance !== 0))
      setDone(true)
      toast.success(`Stock take complete. ${data.adjustedCount} adjustments made.`)
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 p-6">
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <CheckCircle className="h-12 w-12 text-green-500" />
          <h2 className="text-xl font-bold">Stock Take Complete</h2>
          <p className="text-muted-foreground">
            {variances.length > 0
              ? `${variances.length} variance(s) adjusted.`
              : 'No variances found — stock matches physical count.'}
          </p>
        </div>
        {variances.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Variance Report</CardTitle>
            </CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-muted-foreground border-b text-xs">
                    <th className="pb-2 text-left">Product</th>
                    <th className="pb-2 text-right">Expected</th>
                    <th className="pb-2 text-right">Counted</th>
                    <th className="pb-2 text-right">Variance</th>
                  </tr>
                </thead>
                <tbody>
                  {variances.map((v) => {
                    const prod = products.find((p) => p.id === v.productId)
                    return (
                      <tr key={v.productId} className="border-b">
                        <td className="py-2">{prod?.name ?? v.productId}</td>
                        <td className="py-2 text-right font-mono">{v.expected}</td>
                        <td className="py-2 text-right font-mono">{v.counted}</td>
                        <td
                          className={`py-2 text-right font-mono font-bold ${v.variance > 0 ? 'text-green-600' : 'text-red-600'}`}
                        >
                          {v.variance > 0 ? '+' : ''}
                          {v.variance}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}
        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => {
              setDone(false)
              setVariances([])
            }}
          >
            New Count
          </Button>
          <Button className="flex-1" onClick={() => router.push('/admin/inventory')}>
            Back to Inventory
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <div>
        <Link
          href="/admin/inventory"
          className="text-muted-foreground hover:text-foreground mb-2 flex items-center text-sm"
        >
          <ChevronLeft className="mr-1 h-4 w-4" /> Inventory
        </Link>
        <h1 className="text-2xl font-bold">Physical Stock Take</h1>
        <p className="text-muted-foreground text-sm">
          Count your physical stock and auto-adjust variances.
        </p>
      </div>

      <div className="space-y-1">
        <Label>Warehouse *</Label>
        <Select value={warehouseId} onValueChange={setWarehouseId}>
          <SelectTrigger className="max-w-xs">
            <SelectValue placeholder="Select warehouse…" />
          </SelectTrigger>
          <SelectContent>
            {warehouses.map((w) => (
              <SelectItem key={w.id} value={w.id}>
                {w.name} ({w.code})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {warehouseId &&
        (loading ? (
          <div className="text-muted-foreground text-sm">Loading products…</div>
        ) : products.length === 0 ? (
          <Card>
            <CardContent className="text-muted-foreground py-12 text-center text-sm">
              No stock in this warehouse.
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">
                Enter Physical Counts ({products.length} products)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {products.map((p) => {
                  const counted = Number(counts[p.id] ?? p.quantity)
                  const variance = counted - p.quantity
                  return (
                    <div
                      key={p.id}
                      className="flex items-center gap-3 border-b pb-2 last:border-b-0"
                    >
                      <div className="flex-1">
                        <p className="font-medium">{p.name}</p>
                        <p className="text-muted-foreground font-mono text-xs">
                          {p.sku} · System: {p.quantity}
                        </p>
                      </div>
                      <Input
                        type="number"
                        min="0"
                        className="w-24 text-right"
                        value={counts[p.id] ?? String(p.quantity)}
                        onChange={(e) => setCounts((c) => ({ ...c, [p.id]: e.target.value }))}
                      />
                      {variance !== 0 && (
                        <Badge
                          variant={variance > 0 ? 'default' : 'destructive'}
                          className="w-16 justify-center text-xs"
                        >
                          {variance > 0 ? '+' : ''}
                          {variance}
                        </Badge>
                      )}
                    </div>
                  )
                })}
              </div>
              <Button className="mt-4 w-full" onClick={handleSubmit} disabled={submitting}>
                {submitting ? 'Processing…' : 'Submit Stock Take'}
              </Button>
            </CardContent>
          </Card>
        ))}
    </div>
  )
}
