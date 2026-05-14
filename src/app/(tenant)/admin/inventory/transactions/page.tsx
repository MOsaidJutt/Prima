'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Pagination } from '@/components/data-table'
import { formatDistanceToNow } from 'date-fns'

type Transaction = {
  id: string
  type: string
  quantity: number
  reason: string | null
  createdAt: string
  product: { name: string; sku: string }
  fromWarehouse: { name: string } | null
  toWarehouse: { name: string } | null
  performedByUser: { name: string } | null
}

const TX_COLORS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  PURCHASE: 'default',
  SALE: 'secondary',
  ADJUSTMENT_IN: 'outline',
  ADJUSTMENT_OUT: 'outline',
  TRANSFER_IN: 'default',
  TRANSFER_OUT: 'secondary',
  RETURN: 'outline',
  WRITE_OFF: 'destructive',
  STOCK_TAKE: 'outline',
}

const TX_LABELS: Record<string, string> = {
  PURCHASE: '+ Purchase',
  SALE: '– Sale',
  ADJUSTMENT_IN: '+ Adjustment',
  ADJUSTMENT_OUT: '– Adjustment',
  TRANSFER_IN: '→ Transfer In',
  TRANSFER_OUT: '← Transfer Out',
  RETURN: '+ Return',
  WRITE_OFF: '– Write-off',
  STOCK_TAKE: '± Stock Take',
}

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [type, setType] = useState('all')
  const PAGE_SIZE = 25

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(PAGE_SIZE),
      ...(type !== 'all' && { type }),
    })
    fetch(`/api/v1/inventory/transactions?${params}`)
      .then((r) => r.json())
      .then((d) => {
        setTransactions(d.transactions ?? [])
        setTotal(d.total ?? 0)
      })
      .catch(() => toast.error('Failed to load'))
      .finally(() => setLoading(false))
  }, [page, type])

  return (
    <div className="space-y-6 p-6">
      <div>
        <Link
          href="/admin/inventory"
          className="text-muted-foreground hover:text-foreground mb-2 flex items-center text-sm"
        >
          <ChevronLeft className="mr-1 h-4 w-4" /> Inventory
        </Link>
        <h1 className="text-2xl font-bold">Inventory Transactions</h1>
        <p className="text-muted-foreground text-sm">{total} total movements</p>
      </div>

      <div className="flex gap-3">
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {Object.entries(TX_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Product</th>
              <th className="px-3 py-2 text-left font-medium">Type</th>
              <th className="px-3 py-2 text-right font-medium">Qty</th>
              <th className="px-3 py-2 text-left font-medium">Route</th>
              <th className="px-3 py-2 text-left font-medium">Reason</th>
              <th className="px-3 py-2 text-left font-medium">By</th>
              <th className="px-3 py-2 text-left font-medium">When</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className="border-t">
                  {Array.from({ length: 7 }).map((_, j) => (
                    <td key={j} className="px-3 py-3">
                      <div className="bg-muted h-4 animate-pulse rounded" />
                    </td>
                  ))}
                </tr>
              ))
            ) : transactions.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-muted-foreground py-12 text-center">
                  No transactions found.
                </td>
              </tr>
            ) : (
              transactions.map((tx) => (
                <tr key={tx.id} className="hover:bg-muted/20 border-t">
                  <td className="px-3 py-2">
                    <p className="font-medium">{tx.product.name}</p>
                    <p className="text-muted-foreground font-mono text-xs">{tx.product.sku}</p>
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant={TX_COLORS[tx.type] ?? 'outline'}>
                      {TX_LABELS[tx.type] ?? tx.type}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-right font-mono font-medium">{tx.quantity}</td>
                  <td className="text-muted-foreground px-3 py-2">
                    {tx.fromWarehouse?.name ?? '—'} {tx.fromWarehouse && tx.toWarehouse ? '→' : ''}{' '}
                    {tx.toWarehouse?.name ?? ''}
                  </td>
                  <td className="text-muted-foreground max-w-xs truncate px-3 py-2">
                    {tx.reason ?? '—'}
                  </td>
                  <td className="text-muted-foreground px-3 py-2">
                    {tx.performedByUser?.name ?? '—'}
                  </td>
                  <td className="text-muted-foreground px-3 py-2">
                    {formatDistanceToNow(new Date(tx.createdAt), { addSuffix: true })}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
    </div>
  )
}
