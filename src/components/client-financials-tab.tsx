'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { InvoiceStatusBadge } from '@/components/invoice/invoice-status-badge'
import { format } from 'date-fns'

interface Invoice {
  id: string
  invoiceNumber: string
  issueDate: string
  dueDate: string | null
  grandTotal: number
  paidAmount: number
  status: string
}

interface Payment {
  id: string
  amount: number
  paymentDate: string
  method: string
  referenceNumber: string | null
}

interface FinancialData {
  invoices: Invoice[]
  payments: Payment[]
  summary: {
    totalInvoiced: number
    totalPaid: number
    outstanding: number
    totalOrders: number
    averageOrderValue: number
    totalLifetimeValue: number
    averageDaysToPay: number | null
  }
}

export function ClientFinancialsTab({
  clientId,
  creditLimit,
}: {
  clientId: string
  creditLimit: number
}) {
  const [data, setData] = useState<FinancialData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [invRes, payRes] = await Promise.all([
        fetch(`/api/v1/invoices?clientId=${clientId}&pageSize=100`),
        fetch(`/api/v1/clients/${clientId}/payments`),
      ])
      const invData = await invRes.json()
      const payData = payRes.ok ? await payRes.json() : { payments: [] }

      const invoices: Invoice[] = (invData.data ?? []).map((inv: Record<string, unknown>) => ({
        id: inv.id as string,
        invoiceNumber: inv.invoiceNumber as string,
        issueDate: inv.issueDate as string,
        dueDate: inv.dueDate as string | null,
        grandTotal: Number(inv.grandTotal),
        paidAmount: Number(inv.paidAmount),
        status: inv.status as string,
      }))

      const payments: Payment[] = (payData.payments ?? []).map((p: Record<string, unknown>) => ({
        id: p.id as string,
        amount: Number(p.amount),
        paymentDate: p.paymentDate as string,
        method: p.method as string,
        referenceNumber: p.referenceNumber as string | null,
      }))

      const totalInvoiced = invoices.reduce((s, i) => s + i.grandTotal, 0)
      const totalPaid = invoices.reduce((s, i) => s + i.paidAmount, 0)
      const outstanding = totalInvoiced - totalPaid
      const paidInvoices = invoices.filter((i) => i.status === 'PAID' && i.dueDate)
      const avgDays =
        paidInvoices.length > 0
          ? Math.round(
              paidInvoices.reduce((s, i) => {
                const days = Math.max(
                  0,
                  (new Date(i.issueDate).getTime() - new Date(i.issueDate).getTime()) / 86400000
                )
                return s + days
              }, 0) / paidInvoices.length
            )
          : null

      setData({
        invoices,
        payments,
        summary: {
          totalInvoiced,
          totalPaid,
          outstanding,
          totalOrders: invoices.length,
          averageOrderValue: invoices.length > 0 ? totalInvoiced / invoices.length : 0,
          totalLifetimeValue: totalPaid,
          averageDaysToPay: avgDays,
        },
      })
    }
    load()
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [clientId])

  if (loading)
    return <div className="text-muted-foreground py-8 text-center">Loading financials…</div>
  if (!data) return <div className="text-muted-foreground py-8 text-center">Failed to load.</div>

  const utilizationPct =
    creditLimit > 0 ? Math.min(100, Math.round((data.summary.outstanding / creditLimit) * 100)) : 0

  return (
    <div className="space-y-6">
      {/* Summary KPIs */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-5">
            <p className="text-muted-foreground text-xs">Outstanding Balance</p>
            <p
              className={`text-2xl font-bold ${data.summary.outstanding > 0 ? 'text-destructive' : 'text-green-600'}`}
            >
              PKR {data.summary.outstanding.toLocaleString('en-PK')}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-muted-foreground text-xs">Total Lifetime Value</p>
            <p className="text-2xl font-bold">
              PKR {data.summary.totalInvoiced.toLocaleString('en-PK')}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-muted-foreground text-xs">Avg Order Value</p>
            <p className="text-2xl font-bold">
              PKR {Math.round(data.summary.averageOrderValue).toLocaleString('en-PK')}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Credit utilization */}
      {creditLimit > 0 && (
        <Card>
          <CardContent className="pt-5">
            <div className="mb-2 flex justify-between text-sm">
              <span className="font-medium">Credit Limit Utilization</span>
              <span className="text-muted-foreground">
                {utilizationPct}% of PKR {creditLimit.toLocaleString('en-PK')}
              </span>
            </div>
            <div className="bg-muted h-3 rounded-full">
              <div
                className={`h-3 rounded-full transition-all ${utilizationPct >= 90 ? 'bg-destructive' : utilizationPct >= 70 ? 'bg-amber-500' : 'bg-green-500'}`}
                style={{ width: `${utilizationPct}%` }}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Invoice List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Invoices ({data.invoices.length})</CardTitle>
          <Link
            href={`/admin/invoices/new?clientId=${clientId}`}
            className="text-accent text-xs hover:underline"
          >
            + New Invoice
          </Link>
        </CardHeader>
        <CardContent>
          {data.invoices.length === 0 ? (
            <p className="text-muted-foreground text-sm">No invoices yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted-foreground border-b text-xs">
                  <th className="pb-2 text-left">Invoice #</th>
                  <th className="pb-2 text-left">Date</th>
                  <th className="pb-2 text-left">Due</th>
                  <th className="pb-2 text-right">Total</th>
                  <th className="pb-2 text-right">Balance</th>
                  <th className="pb-2 text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.invoices.slice(0, 20).map((inv) => {
                  const bal = inv.grandTotal - inv.paidAmount
                  return (
                    <tr key={inv.id} className="border-b last:border-0">
                      <td className="py-2">
                        <Link
                          href={`/admin/invoices/${inv.id}`}
                          className="text-accent font-mono hover:underline"
                        >
                          {inv.invoiceNumber}
                        </Link>
                      </td>
                      <td className="py-2">{format(new Date(inv.issueDate), 'MMM d, yyyy')}</td>
                      <td className="py-2">
                        {inv.dueDate ? format(new Date(inv.dueDate), 'MMM d') : '—'}
                      </td>
                      <td className="py-2 text-right font-mono">
                        PKR {inv.grandTotal.toLocaleString('en-PK')}
                      </td>
                      <td
                        className={`py-2 text-right font-mono ${bal > 0 ? 'text-destructive' : 'text-green-600'}`}
                      >
                        PKR {bal.toLocaleString('en-PK')}
                      </td>
                      <td className="py-2 text-center">
                        <InvoiceStatusBadge status={inv.status} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Payment History */}
      <Card>
        <CardHeader>
          <CardTitle>Payment History ({data.payments.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {data.payments.length === 0 ? (
            <p className="text-muted-foreground text-sm">No payments recorded.</p>
          ) : (
            <div className="space-y-2">
              {data.payments.slice(0, 20).map((p) => (
                <div
                  key={p.id}
                  className="flex justify-between border-b pb-2 text-sm last:border-0"
                >
                  <div>
                    <span className="font-medium">PKR {p.amount.toLocaleString('en-PK')}</span>
                    <span className="text-muted-foreground ml-2">{p.method}</span>
                    {p.referenceNumber && (
                      <span className="text-muted-foreground ml-2 text-xs">
                        Ref: {p.referenceNumber}
                      </span>
                    )}
                  </div>
                  <span className="text-muted-foreground">
                    {format(new Date(p.paymentDate), 'MMM d, yyyy')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
