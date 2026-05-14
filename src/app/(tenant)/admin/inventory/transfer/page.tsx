'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import Link from 'next/link'
import { ChevronLeft, ArrowRight } from 'lucide-react'
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

export default function TransferPage() {
  const router = useRouter()
  const [products, setProducts] = useState<Product[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [productId, setProductId] = useState('')
  const [fromWarehouseId, setFromWarehouseId] = useState('')
  const [toWarehouseId, setToWarehouseId] = useState('')
  const [quantity, setQuantity] = useState('')
  const [notes, setNotes] = useState('')
  const [fromStock, setFromStock] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch('/api/v1/products?pageSize=100&status=ACTIVE').then((r) => r.json()),
      fetch('/api/v1/warehouses').then((r) => r.json()),
    ]).then(([prods, whs]) => {
      setProducts(prods.products ?? [])
      setWarehouses(whs.warehouses ?? [])
    })
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!productId || !fromWarehouseId) {
      setFromStock(null)
      return
    }
    fetch(`/api/v1/products/${productId}`)
      .then((r) => r.json())
      .then((p) => {
        const s = p.inventoryStock?.find(
          (s: { warehouseId: string; quantity: number }) => s.warehouseId === fromWarehouseId
        )
        setFromStock(s?.quantity ?? 0)
      })
  }, [productId, fromWarehouseId])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const qty = Number(quantity)
    if (!productId || !fromWarehouseId || !toWarehouseId || !qty) {
      toast.error('Fill all required fields')
      return
    }
    if (fromWarehouseId === toWarehouseId) {
      toast.error('Source and destination must differ')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/v1/inventory/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId,
          fromWarehouseId,
          toWarehouseId,
          quantity: qty,
          notes: notes || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success(`Transferred ${qty} units successfully`)
      router.push('/admin/inventory')
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  const fromWh = warehouses.find((w) => w.id === fromWarehouseId)
  const toWh = warehouses.find((w) => w.id === toWarehouseId)

  return (
    <div className="mx-auto max-w-lg space-y-6 p-6">
      <div>
        <Link
          href="/admin/inventory"
          className="text-muted-foreground hover:text-foreground mb-2 flex items-center text-sm"
        >
          <ChevronLeft className="mr-1 h-4 w-4" /> Inventory
        </Link>
        <h1 className="text-2xl font-bold">Transfer Stock</h1>
        <p className="text-muted-foreground text-sm">Move stock between warehouses.</p>
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

            <div className="flex items-end gap-3">
              <div className="flex-1 space-y-1">
                <Label>From *</Label>
                <Select value={fromWarehouseId} onValueChange={setFromWarehouseId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Source…" />
                  </SelectTrigger>
                  <SelectContent>
                    {warehouses
                      .filter((w) => w.id !== toWarehouseId)
                      .map((w) => (
                        <SelectItem key={w.id} value={w.id}>
                          {w.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <ArrowRight className="text-muted-foreground mb-2.5 h-4 w-4 shrink-0" />
              <div className="flex-1 space-y-1">
                <Label>To *</Label>
                <Select value={toWarehouseId} onValueChange={setToWarehouseId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Destination…" />
                  </SelectTrigger>
                  <SelectContent>
                    {warehouses
                      .filter((w) => w.id !== fromWarehouseId)
                      .map((w) => (
                        <SelectItem key={w.id} value={w.id}>
                          {w.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {fromStock !== null && fromWarehouseId && (
              <div className="bg-muted rounded-md px-3 py-2 text-sm">
                Available in {fromWh?.name}: <span className="font-bold">{fromStock}</span> units
              </div>
            )}

            <div className="space-y-1">
              <Label>Quantity *</Label>
              <Input
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="e.g. 25"
              />
            </div>
            <div className="space-y-1">
              <Label>Notes</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
            </div>

            {fromWh && toWh && quantity && (
              <div className="bg-primary/5 border-primary/20 rounded-md border p-3 text-sm">
                Transfer <span className="font-bold">{quantity}</span> units of{' '}
                {products.find((p) => p.id === productId)?.name ?? '—'} from{' '}
                <span className="font-medium">{fromWh.name}</span> to{' '}
                <span className="font-medium">{toWh.name}</span>
              </div>
            )}

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
                {submitting ? 'Transferring…' : 'Transfer Stock'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
