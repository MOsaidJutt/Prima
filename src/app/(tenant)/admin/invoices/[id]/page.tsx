import { redirect, notFound } from 'next/navigation'
import { getTenantSession } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft } from 'lucide-react'
import { format } from 'date-fns'
import { InvoiceStatusBadge } from '@/components/invoice/invoice-status-badge'
import { InvoiceActions } from '@/components/invoice/invoice-actions'
import { RecordPaymentModal } from '@/components/invoice/record-payment-modal'

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getTenantSession()
  if (!session) redirect('/login')

  const { id } = await params
  const invoice = await prisma.invoice.findFirst({
    where: { id, organizationId: session.organizationId, deletedAt: null },
    include: {
      client: true,
      distributor: { select: { companyName: true, code: true } },
      template: { select: { taxLabel: true, primaryColor: true } },
      lineItems: {
        orderBy: { sortOrder: 'asc' },
        include: { product: { select: { name: true, sku: true } } },
      },
      payments: {
        where: { deletedAt: null },
        orderBy: { paymentDate: 'desc' },
        include: { recordedBy: { select: { name: true } } },
      },
      createdBy: { select: { name: true } },
    },
  })
  if (!invoice) notFound()

  const balance = Number(invoice.grandTotal) - Number(invoice.paidAmount)
  const taxLabel = invoice.template?.taxLabel ?? 'GST'

  return (
    <div className="max-w-5xl space-y-6 p-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/admin/invoices">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="font-mono text-2xl font-bold">Invoice {invoice.invoiceNumber}</h1>
          <p className="text-muted-foreground">
            {invoice.client.companyName} · Issued {format(invoice.issueDate, 'MMM d, yyyy')}
            {invoice.dueDate && ` · Due ${format(invoice.dueDate, 'MMM d, yyyy')}`}
          </p>
        </div>
        <InvoiceStatusBadge status={invoice.status} />
      </div>

      {/* Actions Bar */}
      <InvoiceActions
        invoice={{ id: invoice.id, status: invoice.status, invoiceNumber: invoice.invoiceNumber }}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Invoice */}
        <div className="space-y-6 lg:col-span-2">
          {/* Bill To */}
          <Card>
            <CardContent className="pt-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
                    Bill To
                  </p>
                  <p className="font-bold">{invoice.client.companyName}</p>
                  {invoice.client.contactName && (
                    <p className="text-sm">{invoice.client.contactName}</p>
                  )}
                  {invoice.client.email && (
                    <p className="text-muted-foreground text-sm">{invoice.client.email}</p>
                  )}
                  {invoice.client.phone && (
                    <p className="text-muted-foreground text-sm">{invoice.client.phone}</p>
                  )}
                  {invoice.client.address && (
                    <p className="text-muted-foreground text-sm">{invoice.client.address}</p>
                  )}
                  {invoice.client.city && (
                    <p className="text-muted-foreground text-sm">{invoice.client.city}</p>
                  )}
                </div>
                <div>
                  <p className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
                    Invoice Info
                  </p>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Number</span>
                      <span className="font-mono">{invoice.invoiceNumber}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Issue Date</span>
                      <span>{format(invoice.issueDate, 'MMM d, yyyy')}</span>
                    </div>
                    {invoice.dueDate && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Due Date</span>
                        <span
                          className={
                            balance > 0 && invoice.dueDate < new Date()
                              ? 'text-destructive font-medium'
                              : ''
                          }
                        >
                          {format(invoice.dueDate, 'MMM d, yyyy')}
                        </span>
                      </div>
                    )}
                    {invoice.emailSentAt && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Sent</span>
                        <span>{format(invoice.emailSentAt, 'MMM d, HH:mm')}</span>
                      </div>
                    )}
                    {invoice.openedAt && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Opened</span>
                        <span>{format(invoice.openedAt, 'MMM d, HH:mm')}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Line Items */}
          <Card>
            <CardContent className="pt-6">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-muted-foreground border-b">
                    <th className="pb-2 text-left">Description</th>
                    <th className="pb-2 text-right">Qty</th>
                    <th className="pb-2 text-right">Price</th>
                    <th className="pb-2 text-right">{taxLabel}%</th>
                    <th className="pb-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.lineItems.map((li) => (
                    <tr key={li.id} className="border-b last:border-0">
                      <td className="py-3">
                        <div className="font-medium">{li.description}</div>
                        {li.product && (
                          <div className="text-muted-foreground text-xs">{li.product.sku}</div>
                        )}
                      </td>
                      <td className="py-3 text-right font-mono">{li.quantity}</td>
                      <td className="py-3 text-right font-mono">
                        PKR {Number(li.unitPrice).toLocaleString()}
                      </td>
                      <td className="py-3 text-right font-mono">{Number(li.taxRate)}%</td>
                      <td className="py-3 text-right font-mono font-medium">
                        PKR {Number(li.lineTotal).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={3} />
                    <td className="text-muted-foreground pt-3 text-right">Subtotal</td>
                    <td className="pt-3 text-right font-mono">
                      PKR {Number(invoice.subtotal).toLocaleString()}
                    </td>
                  </tr>
                  {Number(invoice.discountTotal) > 0 && (
                    <tr>
                      <td colSpan={3} />
                      <td className="text-muted-foreground text-right">Discount</td>
                      <td className="text-right font-mono text-green-600">
                        - PKR {Number(invoice.discountTotal).toLocaleString()}
                      </td>
                    </tr>
                  )}
                  <tr>
                    <td colSpan={3} />
                    <td className="text-muted-foreground text-right">{taxLabel}</td>
                    <td className="text-right font-mono">
                      PKR {Number(invoice.taxTotal).toLocaleString()}
                    </td>
                  </tr>
                  {Number(invoice.shippingAmount) > 0 && (
                    <tr>
                      <td colSpan={3} />
                      <td className="text-muted-foreground text-right">Shipping</td>
                      <td className="text-right font-mono">
                        PKR {Number(invoice.shippingAmount).toLocaleString()}
                      </td>
                    </tr>
                  )}
                  <tr>
                    <td colSpan={3} />
                    <td className="pt-2 text-right font-bold">Grand Total</td>
                    <td className="pt-2 text-right font-mono text-lg font-bold">
                      PKR {Number(invoice.grandTotal).toLocaleString()}
                    </td>
                  </tr>
                  <tr>
                    <td colSpan={3} />
                    <td className="text-right text-green-600">Paid</td>
                    <td className="text-right font-mono text-green-600">
                      PKR {Number(invoice.paidAmount).toLocaleString()}
                    </td>
                  </tr>
                  <tr>
                    <td colSpan={3} />
                    <td
                      className={`text-right font-bold ${balance > 0 ? 'text-destructive' : 'text-green-600'}`}
                    >
                      Balance
                    </td>
                    <td
                      className={`text-right font-mono font-bold ${balance > 0 ? 'text-destructive' : 'text-green-600'}`}
                    >
                      PKR {balance.toLocaleString()}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </CardContent>
          </Card>

          {(invoice.notes || invoice.terms) && (
            <Card>
              <CardContent className="space-y-3 pt-6 text-sm">
                {invoice.notes && (
                  <div>
                    <p className="mb-1 font-medium">Notes</p>
                    <p className="text-muted-foreground">{invoice.notes}</p>
                  </div>
                )}
                {invoice.terms && (
                  <div>
                    <p className="mb-1 font-medium">Terms & Conditions</p>
                    <p className="text-muted-foreground">{invoice.terms}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Record Payment */}
          {['ISSUED', 'PARTIALLY_PAID', 'OVERDUE'].includes(invoice.status) && (
            <RecordPaymentModal
              invoiceId={invoice.id}
              balance={balance}
              invoiceNumber={invoice.invoiceNumber}
            />
          )}

          {/* Payment History */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Payment History</CardTitle>
            </CardHeader>
            <CardContent>
              {invoice.payments.length === 0 ? (
                <p className="text-muted-foreground text-xs">No payments recorded yet.</p>
              ) : (
                <div className="space-y-3">
                  {invoice.payments.map((p) => (
                    <div key={p.id} className="border-b pb-2 text-xs last:border-0">
                      <div className="flex justify-between font-medium">
                        <span>PKR {Number(p.amount).toLocaleString()}</span>
                        <span className="text-green-600">{p.method}</span>
                      </div>
                      <div className="text-muted-foreground">
                        {format(p.paymentDate, 'MMM d, yyyy')}
                      </div>
                      {p.recordedBy && (
                        <div className="text-muted-foreground">by {p.recordedBy.name}</div>
                      )}
                      {p.referenceNumber && (
                        <div className="text-muted-foreground">Ref: {p.referenceNumber}</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
