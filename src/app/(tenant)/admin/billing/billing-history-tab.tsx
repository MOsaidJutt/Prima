'use client'

import { useCallback, useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Loader2, Download } from 'lucide-react'
import type { TopUpOrderStatus } from '@prisma/client'
import { BillingErrorState } from '@/components/billing/billing-error-state'

interface InvoiceDTO {
  id: string
  invoiceNumber: string
  issueDate: string
  dueDate: string
  totalAmount: string
  status: string
  paidAt: string | null
}

interface TopUpOrderDTO {
  id: string
  tokens: number
  priceUsd: string
  status: TopUpOrderStatus
  isAutoTopUp: boolean
  createdAt: string
  pack: { name: string }
}

const INVOICE_STATUS_VARIANT: Record<
  string,
  'success' | 'warning' | 'destructive' | 'secondary' | 'outline' | 'info'
> = {
  DRAFT: 'secondary',
  ISSUED: 'info',
  PARTIALLY_PAID: 'warning',
  PAID: 'success',
  OVERDUE: 'destructive',
  CANCELLED: 'outline',
}

const TOPUP_STATUS_VARIANT: Record<
  TopUpOrderStatus,
  'success' | 'warning' | 'destructive' | 'secondary' | 'outline' | 'info'
> = {
  PENDING: 'warning',
  COMPLETED: 'success',
  FAILED: 'destructive',
  REFUNDED: 'outline',
}

function formatPkr(n: number): string {
  return `Rs ${n.toLocaleString()}`
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString()
}

export function BillingHistoryTab() {
  const [invoices, setInvoices] = useState<InvoiceDTO[] | null>(null)
  const [invoicesError, setInvoicesError] = useState(false)
  const [topups, setTopups] = useState<TopUpOrderDTO[] | null>(null)
  const [topupsError, setTopupsError] = useState(false)

  // Fetch-only loaders for the mount effect; the retry variants (event
  // handlers) also reset state so no setState runs synchronously inside the
  // effect body.
  const fetchInvoices = useCallback(() => {
    fetch('/api/v1/billing/invoices')
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load invoices')
        return r.json()
      })
      .then((d) => setInvoices(d.invoices ?? []))
      .catch(() => setInvoicesError(true))
  }, [])

  const fetchTopups = useCallback(() => {
    fetch('/api/v1/billing/topups')
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load top-up orders')
        return r.json()
      })
      .then((d) => setTopups(d.orders ?? []))
      .catch(() => setTopupsError(true))
  }, [])

  const retryInvoices = useCallback(() => {
    setInvoicesError(false)
    setInvoices(null)
    fetchInvoices()
  }, [fetchInvoices])

  const retryTopups = useCallback(() => {
    setTopupsError(false)
    setTopups(null)
    fetchTopups()
  }, [fetchTopups])

  useEffect(() => {
    fetchInvoices()
    fetchTopups()
  }, [fetchInvoices, fetchTopups])

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Invoices</CardTitle>
        </CardHeader>
        <CardContent>
          {invoicesError ? (
            <BillingErrorState message="Could not load invoices." onRetry={retryInvoices} />
          ) : !invoices ? (
            <div className="flex h-32 items-center justify-center">
              <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
            </div>
          ) : invoices.length === 0 ? (
            <p className="text-muted-foreground text-sm">No invoices yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Issued</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">PDF</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-mono text-xs">{inv.invoiceNumber}</TableCell>
                    <TableCell>{formatDate(inv.issueDate)}</TableCell>
                    <TableCell>{formatDate(inv.dueDate)}</TableCell>
                    <TableCell>{formatPkr(Number(inv.totalAmount))}</TableCell>
                    <TableCell>
                      <Badge variant={INVOICE_STATUS_VARIANT[inv.status] ?? 'secondary'}>
                        {inv.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <a
                        href={`/api/v1/billing/invoices/${inv.id}/pdf`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary inline-flex items-center gap-1 hover:underline"
                      >
                        <Download className="h-3.5 w-3.5" />
                        Download
                      </a>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Token Top-Up Orders</CardTitle>
        </CardHeader>
        <CardContent>
          {topupsError ? (
            <BillingErrorState message="Could not load top-up orders." onRetry={retryTopups} />
          ) : !topups ? (
            <div className="flex h-32 items-center justify-center">
              <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
            </div>
          ) : topups.length === 0 ? (
            <p className="text-muted-foreground text-sm">No top-up orders yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Pack</TableHead>
                  <TableHead>Tokens</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topups.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell>{formatDate(order.createdAt)}</TableCell>
                    <TableCell>{order.pack.name}</TableCell>
                    <TableCell>{order.tokens.toLocaleString()}</TableCell>
                    <TableCell>${Number(order.priceUsd).toFixed(2)}</TableCell>
                    <TableCell>{order.isAutoTopUp ? 'Auto' : 'Manual'}</TableCell>
                    <TableCell>
                      <Badge variant={TOPUP_STATUS_VARIANT[order.status]}>{order.status}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
