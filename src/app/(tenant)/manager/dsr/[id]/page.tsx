import { redirect, notFound } from 'next/navigation'
import { getTenantSession } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft, Star, MapPin, Calendar } from 'lucide-react'
import { format } from 'date-fns'
import { DSRStatusBadge } from '@/components/dsr/dsr-status-badge'
import { DSRApprovalActions } from '@/components/dsr/dsr-approval-actions'

export default async function ManagerDSRViewPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getTenantSession()
  if (!session) redirect('/login')

  const { id } = await params
  const entry = await prisma.dSREntry.findFirst({
    where: { id, organizationId: session.organizationId, deletedAt: null },
    include: {
      client: { select: { companyName: true, code: true, city: true, email: true, phone: true } },
      submittedBy: { select: { name: true, email: true } },
      approvedBy: { select: { name: true } },
      lineItems: {
        include: { product: { select: { name: true, sku: true, unitOfMeasure: true } } },
        orderBy: { createdAt: 'asc' },
      },
    },
  })
  if (!entry) notFound()

  return (
    <div className="max-w-4xl space-y-6 p-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/manager/dsr/pending">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">DSR Review — {entry.client.companyName}</h1>
          <p className="text-muted-foreground">
            {entry.submittedBy.name} · {format(entry.reportDate, 'EEEE, MMMM d, yyyy')}
          </p>
        </div>
        <DSRStatusBadge status={entry.status} />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Visit Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Client</span>
              <span className="font-medium">{entry.client.companyName}</span>
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

        <Card>
          <CardHeader>
            <CardTitle>Submitter</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Name</span>
              <span>{entry.submittedBy.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Email</span>
              <span>{entry.submittedBy.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Submitted at</span>
              <span>{format(entry.createdAt, 'MMM d, yyyy HH:mm')}</span>
            </div>
            {entry.rejectionReason && (
              <div className="bg-destructive/10 text-destructive rounded-md p-3">
                <strong>Rejection reason:</strong> {entry.rejectionReason}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Line Items */}
      <Card>
        <CardHeader>
          <CardTitle>Products</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted-foreground border-b">
                <th className="pb-2 text-left">Product</th>
                <th className="pb-2 text-right">Qty</th>
                <th className="pb-2 text-right">Unit Price</th>
                <th className="pb-2 text-right">Tax</th>
                <th className="pb-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {entry.lineItems.map((li) => (
                <tr key={li.id} className="border-b last:border-0">
                  <td className="py-3">
                    <div className="font-medium">{li.product.name}</div>
                    <div className="text-muted-foreground text-xs">{li.product.sku}</div>
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
              <tr className="border-t font-bold">
                <td colSpan={3} />
                <td className="pt-3 text-right">Grand Total</td>
                <td className="pt-3 text-right font-mono text-lg">
                  PKR {Number(entry.grandTotal).toLocaleString()}
                </td>
              </tr>
            </tfoot>
          </table>
        </CardContent>
      </Card>

      {/* Approval Actions */}
      {entry.status === 'SUBMITTED' && <DSRApprovalActions dsrId={id} />}
    </div>
  )
}
