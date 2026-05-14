'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type Product = { id: string; sku: string; name: string }
type Warehouse = { id: string; code: string; name: string }

function AdjustForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const preselectedProductId = searchParams.get('productId') ?? ''

  const [products, setProducts] = useState<Product[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [productId, setProductId] = useState(preselectedProductId)
  const [warehouseId, setWarehouseId] = useState('')
  const [quantity, setQuantity] = useState('')
  const [reason, setReason] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [currentStock, setCurrentStock] = useState<number | null>(null)

  useEffect(() => {
    Promise.all([
      fetch('/api/v1/products?pageSize=100&status=ACTIVE').then((r) => r.json()),
      fetch('/api/v1/warehouses').then((r) => r.json()),
    ]).then(([prods, whs]) => {
      setProducts(prods.products ?? [])
      setWarehouses(whs.warehouses ?? [])
      if (whs.warehouses?.[0]) setWarehouseId(whs.warehouses[0].id)
    })
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!productId || !warehouseId) {
      setCurrentStock(null)
      return
    }
    fetch(`/api/v1/products/${productId}`)
      .then((r) => r.json())
      .then((p) => {
        const s = p.inventoryStock?.find(
          (s: { warehouseId: string; quantity: number }) => s.warehouseId === warehouseId
        )
        setCurrentStock(s?.quantity ?? 0)
      })
  }, [productId, warehouseId])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const qty = Number(quantity)
    if (!productId || !warehouseId || isNaN(qty) || qty === 0 || !reason.trim()) {
      toast.error('Fill all required fields (quantity cannot be zero)')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/v1/inventory/adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId,
          warehouseId,
          quantity: qty,
          reason: reason.trim(),
          notes: notes.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success(`Stock adjusted. New quantity: ${data.newQuantity}`)
      router.push('/admin/inventory')
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  const qty = Number(quantity)
  const newQty = currentStock !== null && !isNaN(qty) ? currentStock + qty : null

  return (
    <div className="mx-auto max-w-lg space-y-6 p-6">
      <div>
        <Link
          href="/admin/inventory"
          className="text-muted-foreground hover:text-foreground mb-2 flex items-center text-sm"
        >
          <ChevronLeft className="mr-1 h-4 w-4" /> Inventory
        </Link>
        <h1 className="text-2xl font-bold">Manual Stock Adjustment</h1>
        <p className="text-muted-foreground text-sm">
          Enter a positive number to add stock, negative to subtract.
        </p>
      </div>

      <Card>
        <CardContent className="pt-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <Label>Product *</Label>
              <Select value={productId} onValueChange={setProductId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select product…" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} ({p.sku})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Warehouse *</Label>
              <Select value={warehouseId} onValueChange={setWarehouseId}>
                <SelectTrigger>
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
            {currentStock !== null && (
              <div className="bg-muted rounded-md p-3 text-sm">
                <span className="text-muted-foreground">Current stock: </span>
                <span className="font-bold">{currentStock}</span>
                {newQty !== null && newQty !== currentStock && (
                  <span className="ml-3">
                    → New:{' '}
                    <span className={`font-bold ${newQty < 0 ? 'text-destructive' : ''}`}>
                      {newQty}
                    </span>
                  </span>
                )}
              </div>
            )}
            <div className="space-y-1">
              <Label>
                Quantity *{' '}
                <span className="text-muted-foreground text-xs">
                  (positive to add, negative to subtract)
                </span>
              </Label>
              <Input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="e.g. 50 or -10"
              />
            </div>
            <div className="space-y-1">
              <Label>Reason *</Label>
              <Input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Received from supplier, Damaged goods…"
              />
            </div>
            <div className="space-y-1">
              <Label>Notes</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Optional additional notes"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => router.back()}
              >
                Cancel
              </Button>
              <Button type="submit" className="flex-1" disabled={submitting}>
                {submitting ? 'Adjusting…' : 'Apply Adjustment'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

export default function AdjustPage() {
  return (
    <Suspense>
      <AdjustForm />
    </Suspense>
  )
}
