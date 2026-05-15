import { redirect, notFound } from 'next/navigation'
import { getTenantSession } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft, Pencil, Star, MapPin, Calendar } from 'lucide-react'
import { format } from 'date-fns'
import { DSRStatusBadge } from '@/components/dsr/dsr-status-badge'
import { SubmitDSRButton } from '@/components/dsr/submit-dsr-button'

export default async function DSRViewPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getTenantSession()
  if (!session) redirect('/login')

  const { id } = await params
  const entry = await prisma.dSREntry.findFirst({
    where: { id, organizationId: session.organizationId, deletedAt: null },
    include: {
      client: { select: { companyName: true, code: true, city: true, email: true, phone: true } },
      submittedBy: { select: { name: true } },
      approvedBy: { select: { name: true } },
      lineItems: {
        include: { product: { select: { name: true, sku: true, unitOfMeasure: true } } },
        orderBy: { createdAt: 'asc' },
      },
    },
  })

  if (!entry) notFound()
  // Only submitter or manager can view
  if (entry.submittedById !== session.userId) {
    // Check if the session user has dsr:read_all
    const user = await prisma.user.findFirst({
      where: { id: session.userId, organizationId: session.organizationId },
      include: { role: { select: { permissions: true } } },
    })
    if (!user?.role.permissions.includes('dsr:read_all') && !user?.role.permissions.includes('*')) {
      notFound()
    }
  }

  return (
    <div className="max-w-4xl space-y-6 p-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/dsr">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">DSR — {entry.client.companyName}</h1>
          <p className="text-muted-foreground">{format(entry.reportDate, 'EEEE, MMMM d, yyyy')}</p>
        </div>
        <DSRStatusBadge status={entry.status} />
        {entry.status === 'DRAFT' && (
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href={`/dashboard/dsr/${id}/edit`}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </Link>
            </Button>
            <SubmitDSRButton dsrId={id} />
          </div>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Visit Details */}
        <Card>
          <CardHeader>
            <CardTitle>Visit Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Client</span>
              <span className="font-medium">
                {entry.client.companyName} ({entry.client.code})
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Visit Type</span>
              <span className="capitalize">{entry.visitType.replace('_', ' ').toLowerCase()}</span>
            </div>
            {entry.visitNotes && (
              <div>
                <span className="text-muted-foreground">Notes</span>
                <p className="mt-1">{entry.visitNotes}</p>
              </div>
            )}
            {entry.outcome && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Outcome</span>
                <span>{entry.outcome}</span>
              </div>
            )}
            {entry.followUpDate && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Follow-up</span>
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {format(entry.followUpDate, 'MMM d, yyyy')}
                </span>
              </div>
            )}
            {entry.satisfaction && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Satisfaction</span>
                <span className="flex items-center gap-1">
                  {Array.from({ length: entry.satisfaction }).map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />
                  ))}
                </span>
              </div>
            )}
            {entry.latitude && entry.longitude && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Location</span>
                <span className="flex items-center gap-1 font-mono text-xs">
                  <MapPin className="h-3 w-3" />
                  {Number(entry.latitude).toFixed(4)}, {Number(entry.longitude).toFixed(4)}
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Approval Details */}
        <Card>
          <CardHeader>
            <CardTitle>Status & Approval</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Submitted by</span>
              <span>{entry.submittedBy.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Submitted at</span>
              <span>{format(entry.createdAt, 'MMM d, yyyy HH:mm')}</span>
            </div>
            {entry.approvedBy && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {entry.status === 'REJECTED' ? 'Rejected by' : 'Approved by'}
                </span>
                <span>{entry.approvedBy.name}</span>
              </div>
            )}
            {entry.approvedAt && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">At</span>
                <span>{format(entry.approvedAt, 'MMM d, yyyy HH:mm')}</span>
              </div>
            )}
            {entry.rejectionReason && (
              <div className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
                <strong>Rejection reason:</strong> {entry.rejectionReason}
              </div>
            )}
            {entry.invoiceId && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Invoice</span>
                <Link
                  href={`/admin/invoices/${entry.invoiceId}`}
                  className="text-accent text-xs hover:underline"
                >
                  View Invoice
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Line Items */}
      <Card>
        <CardHeader>
          <CardTitle>Products & Line Items</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted-foreground border-b">
                <th className="pb-2 text-left">Product</th>
                <th className="pb-2 text-right">Qty</th>
                <th className="pb-2 text-right">Unit Price</th>
                <th className="pb-2 text-right">Discount</th>
                <th className="pb-2 text-right">Tax</th>
                <th className="pb-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {entry.lineItems.map((li) => (
                <tr key={li.id} className="border-b last:border-0">
                  <td className="py-3">
                    <div className="font-medium">{li.product.name}</div>
                    <div className="text-muted-foreground text-xs">
                      {li.product.sku} · {li.product.unitOfMeasure}
                    </div>
                  </td>
                  <td className="py-3 text-right font-mono">{li.quantity}</td>
                  <td className="py-3 text-right font-mono">
                    PKR {Number(li.unitPrice).toLocaleString()}
                  </td>
                  <td className="py-3 text-right font-mono">
                    {Number(li.discountAmount) > 0
                      ? `PKR ${Number(li.discountAmount).toLocaleString()}`
                      : '—'}
                  </td>
                  <td className="py-3 text-right font-mono">{Number(li.taxRate)}%</td>
                  <td className="py-3 text-right font-mono font-medium">
                    PKR {Number(li.lineTotal).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t">
                <td colSpan={4} />
                <td className="text-muted-foreground pt-3 text-right">Subtotal</td>
                <td className="pt-3 text-right font-mono">
                  PKR {Number(entry.subtotal).toLocaleString()}
                </td>
              </tr>
              {Number(entry.discountTotal) > 0 && (
                <tr>
                  <td colSpan={4} />
                  <td className="text-muted-foreground text-right">Discount</td>
                  <td className="text-right font-mono text-green-600">
                    - PKR {Number(entry.discountTotal).toLocaleString()}
                  </td>
                </tr>
              )}
              <tr>
                <td colSpan={4} />
                <td className="text-muted-foreground text-right">Tax</td>
                <td className="text-right font-mono">
                  PKR {Number(entry.taxTotal).toLocaleString()}
                </td>
              </tr>
              <tr>
                <td colSpan={4} />
                <td className="pt-2 text-right font-bold">Grand Total</td>
                <td className="pt-2 text-right font-mono text-lg font-bold">
                  PKR {Number(entry.grandTotal).toLocaleString()}
                </td>
              </tr>
            </tfoot>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}
