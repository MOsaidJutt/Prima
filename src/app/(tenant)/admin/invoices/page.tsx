import { redirect } from 'next/navigation'
import { getTenantSession } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PlusCircle } from 'lucide-react'
import { format } from 'date-fns'
import { InvoiceStatusBadge } from '@/components/invoice/invoice-status-badge'

const STATUS_TABS = ['ALL', 'DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED']

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: string; search?: string }>
}) {
  const session = await getTenantSession()
  if (!session) redirect('/login')

  const sp = await searchParams
  const page = Math.max(1, Number(sp.page ?? 1))
  const pageSize = 25
  const activeStatus = sp.status ?? ''
  const search = sp.search ?? ''

  const where = {
    organizationId: session.organizationId,
    deletedAt: null,
    ...(activeStatus && activeStatus !== 'ALL'
      ? {
          status: activeStatus as
            | 'DRAFT'
            | 'ISSUED'
            | 'PARTIALLY_PAID'
            | 'PAID'
            | 'OVERDUE'
            | 'CANCELLED',
        }
      : {}),
    ...(search
      ? {
          OR: [
            { invoiceNumber: { contains: search, mode: 'insensitive' as const } },
            { client: { companyName: { contains: search, mode: 'insensitive' as const } } },
          ],
        }
      : {}),
  }

  const [invoices, total] = await Promise.all([
    prisma.invoice.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        client: { select: { companyName: true, code: true } },
        _count: { select: { payments: true } },
      },
    }),
    prisma.invoice.count({ where }),
  ])

  // Aging buckets for summary
  const now = new Date()
  const overdueInvoices = await prisma.invoice.findMany({
    where: { organizationId: session.organizationId, status: 'OVERDUE', deletedAt: null },
    select: { dueDate: true, grandTotal: true, paidAmount: true },
  })
  const aging = { '0-30': 0, '31-60': 0, '61-90': 0, '90+': 0 }
  for (const inv of overdueInvoices) {
    const days = inv.dueDate ? Math.floor((now.getTime() - inv.dueDate.getTime()) / 86400000) : 0
    const balance = Number(inv.grandTotal) - Number(inv.paidAmount)
    if (days <= 30) aging['0-30'] += balance
    else if (days <= 60) aging['31-60'] += balance
    else if (days <= 90) aging['61-90'] += balance
    else aging['90+'] += balance
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Invoices</h1>
          <p className="text-muted-foreground">{total} total</p>
        </div>
        <Button asChild>
          <Link href="/admin/invoices/new">
            <PlusCircle className="mr-2 h-4 w-4" />
            New Invoice
          </Link>
        </Button>
      </div>

      {/* Aging summary */}
      {overdueInvoices.length > 0 && (
        <div className="grid grid-cols-4 gap-3">
          {(Object.entries(aging) as [string, number][]).map(([range, amount]) => (
            <div key={range} className="rounded-lg border p-3 text-center">
              <div
                className={`mb-1 text-xs font-medium ${range === '90+' ? 'text-destructive' : range === '61-90' ? 'text-orange-500' : 'text-muted-foreground'}`}
              >
                {range} days
              </div>
              <div className="font-mono text-sm font-bold">
                PKR {amount.toLocaleString('en-PK')}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Status tabs */}
      <div className="flex flex-wrap gap-2">
        {STATUS_TABS.map((s) => (
          <Link key={s} href={`/admin/invoices?status=${s}`}>
            <Button
              variant={activeStatus === s || (s === 'ALL' && !activeStatus) ? 'default' : 'outline'}
              size="sm"
            >
              {s.replace('_', ' ')}
            </Button>
          </Link>
        ))}
      </div>

      <div className="rounded-md border">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/40 border-b">
              <th className="text-muted-foreground px-4 py-3 text-left font-medium">Invoice #</th>
              <th className="text-muted-foreground px-4 py-3 text-left font-medium">Client</th>
              <th className="text-muted-foreground px-4 py-3 text-left font-medium">Issue Date</th>
              <th className="text-muted-foreground px-4 py-3 text-left font-medium">Due Date</th>
              <th className="text-muted-foreground px-4 py-3 text-right font-medium">Total</th>
              <th className="text-muted-foreground px-4 py-3 text-right font-medium">Paid</th>
              <th className="text-muted-foreground px-4 py-3 text-center font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {invoices.length === 0 && (
              <tr>
                <td colSpan={7} className="text-muted-foreground py-12 text-center">
                  No invoices found.
                </td>
              </tr>
            )}
            {invoices.map((inv) => {
              const balance = Number(inv.grandTotal) - Number(inv.paidAmount)
              const isOverdue = inv.status === 'OVERDUE'
              return (
                <tr key={inv.id} className="hover:bg-muted/20 border-b transition-colors">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/invoices/${inv.id}`}
                      className="text-accent font-mono font-medium hover:underline"
                    >
                      {inv.invoiceNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <div>{inv.client.companyName}</div>
                    <div className="text-muted-foreground text-xs">{inv.client.code}</div>
                  </td>
                  <td className="px-4 py-3">{format(inv.issueDate, 'MMM d, yyyy')}</td>
                  <td className={`px-4 py-3 ${isOverdue ? 'text-destructive font-medium' : ''}`}>
                    {inv.dueDate ? format(inv.dueDate, 'MMM d, yyyy') : '—'}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">
                    PKR {Number(inv.grandTotal).toLocaleString('en-PK')}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-green-600">
                    PKR {Number(inv.paidAmount).toLocaleString('en-PK')}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <InvoiceStatusBadge status={inv.status} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {total > pageSize && (
        <div className="flex justify-center gap-2">
          {page > 1 && (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/admin/invoices?page=${page - 1}&status=${activeStatus}`}>Previous</Link>
            </Button>
          )}
          <span className="text-muted-foreground flex items-center text-sm">
            Page {page} of {Math.ceil(total / pageSize)}
          </span>
          {page < Math.ceil(total / pageSize) && (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/admin/invoices?page=${page + 1}&status=${activeStatus}`}>Next</Link>
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
