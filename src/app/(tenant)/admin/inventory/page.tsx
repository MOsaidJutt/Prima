'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { AlertTriangle, ArrowLeftRight, ClipboardList, Warehouse, CheckSquare } from 'lucide-react'

type StockRow = {
  id: string
  sku: string
  name: string
  brand: string | null
  category: { name: string } | null
  reorderLevel: number
  totalStock: number
  isLowStock: boolean
  inventoryStock: Array<{ quantity: number; warehouse: { id: string; name: string; code: string } }>
}

type WarehouseOpt = { id: string; code: string; name: string }

export default function InventoryPage() {
  const [stock, setStock] = useState<StockRow[]>([])
  const [warehouses, setWarehouses] = useState<WarehouseOpt[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [warehouseId, setWarehouseId] = useState('all')
  const [lowStockOnly, setLowStockOnly] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams({
      ...(warehouseId !== 'all' && { warehouseId }),
      ...(lowStockOnly && { lowStock: 'true' }),
    })
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    fetch(`/api/v1/inventory/stock?${params}`)
      .then((r) => r.json())
      .then((d) => {
        setStock(d.stock ?? [])
        setWarehouses(d.warehouses ?? [])
      })
      .catch(() => toast.error('Failed to load stock'))
      .finally(() => setLoading(false))
  }, [warehouseId, lowStockOnly])

  const filtered = stock.filter(
    (p) =>
      !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.toLowerCase().includes(search.toLowerCase())
  )
  const lowStockCount = stock.filter((p) => p.isLowStock).length

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Inventory</h1>
          <p className="text-muted-foreground text-sm">
            {stock.length} products across {warehouses.length} warehouses
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/admin/inventory/warehouses">
              <Warehouse className="mr-2 h-4 w-4" />
              Warehouses
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/admin/inventory/transactions">
              <ClipboardList className="mr-2 h-4 w-4" />
              Transactions
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/admin/inventory/transfer">
              <ArrowLeftRight className="mr-2 h-4 w-4" />
              Transfer
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/admin/inventory/stock-take">
              <CheckSquare className="mr-2 h-4 w-4" />
              Stock Take
            </Link>
          </Button>
          <Button asChild>
            <Link href="/admin/inventory/adjust">Adjust Stock</Link>
          </Button>
        </div>
      </div>

      {lowStockCount > 0 && (
        <Card className="border-orange-200 bg-orange-50 dark:border-orange-900 dark:bg-orange-950/30">
          <CardContent className="flex items-center gap-3 pt-4">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            <p className="text-sm font-medium text-orange-700 dark:text-orange-400">
              {lowStockCount} product{lowStockCount > 1 ? 's are' : ' is'} below reorder level.{' '}
              <button onClick={() => setLowStockOnly(true)} className="underline">
                View low stock only
              </button>
            </p>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Search products…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Select value={warehouseId} onValueChange={setWarehouseId}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All Warehouses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Warehouses</SelectItem>
            {warehouses.map((w) => (
              <SelectItem key={w.id} value={w.id}>
                {w.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant={lowStockOnly ? 'default' : 'outline'}
          size="sm"
          onClick={() => setLowStockOnly(!lowStockOnly)}
        >
          <AlertTriangle className="mr-2 h-4 w-4" /> Low Stock Only
        </Button>
      </div>

      {/* Stock matrix table */}
      <div className="rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Product</th>
              <th className="px-3 py-2 text-left font-medium">Category</th>
              {warehouses.map((w) => (
                <th key={w.id} className="px-3 py-2 text-right font-medium">
                  {w.code}
                </th>
              ))}
              <th className="px-3 py-2 text-right font-medium">Total</th>
              <th className="px-3 py-2 text-right font-medium">Reorder</th>
              <th className="px-3 py-2 text-center font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className="border-t">
                  <td colSpan={4 + warehouses.length} className="px-3 py-3">
                    <div className="bg-muted h-4 animate-pulse rounded" />
                  </td>
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={4 + warehouses.length}
                  className="text-muted-foreground py-12 text-center"
                >
                  No products found.
                </td>
              </tr>
            ) : (
              filtered.map((p) => (
                <tr
                  key={p.id}
                  className={`hover:bg-muted/20 border-t ${p.isLowStock ? 'bg-orange-50/50 dark:bg-orange-950/20' : ''}`}
                >
                  <td className="px-3 py-2">
                    <div>
                      <Link
                        href={`/admin/products/${p.id}/edit`}
                        className="font-medium hover:underline"
                      >
                        {p.name}
                      </Link>
                      <p className="text-muted-foreground font-mono text-xs">{p.sku}</p>
                    </div>
                  </td>
                  <td className="text-muted-foreground px-3 py-2">{p.category?.name ?? '—'}</td>
                  {warehouses.map((w) => {
                    const s = p.inventoryStock.find((s) => s.warehouse.id === w.id)
                    return (
                      <td key={w.id} className="px-3 py-2 text-right font-mono">
                        {s?.quantity ?? 0}
                      </td>
                    )
                  })}
                  <td
                    className={`px-3 py-2 text-right font-mono font-bold ${p.isLowStock ? 'text-orange-600' : ''}`}
                  >
                    {p.totalStock}
                  </td>
                  <td className="text-muted-foreground px-3 py-2 text-right">{p.reorderLevel}</td>
                  <td className="px-3 py-2 text-center">
                    {p.isLowStock ? (
                      <Badge
                        variant="outline"
                        className="border-orange-500 text-xs text-orange-600"
                      >
                        Low Stock
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs">
                        OK
                      </Badge>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
