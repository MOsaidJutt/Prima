import { redirect } from 'next/navigation'
import { getTenantSession } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { format } from 'date-fns'
import { Eye } from 'lucide-react'

export default async function PendingDSRsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const session = await getTenantSession()
  if (!session) redirect('/login')

  const sp = await searchParams
  const page = Math.max(1, Number(sp.page ?? 1))
  const pageSize = 25

  const where = {
    organizationId: session.organizationId,
    status: 'SUBMITTED' as const,
    deletedAt: null,
  }

  const [entries, total] = await Promise.all([
    prisma.dSREntry.findMany({
      where,
      orderBy: { createdAt: 'asc' }, // oldest first — FIFO queue
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        client: { select: { companyName: true, city: true } },
        submittedBy: { select: { name: true } },
        _count: { select: { lineItems: true } },
      },
    }),
    prisma.dSREntry.count({ where }),
  ])

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Pending DSR Approvals</h1>
        <p className="text-muted-foreground">
          {total} DSR{total !== 1 ? 's' : ''} awaiting your review
        </p>
      </div>

      <div className="rounded-md border">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/40 border-b">
              <th className="text-muted-foreground px-4 py-3 text-left font-medium">
                Submitted By
              </th>
              <th className="text-muted-foreground px-4 py-3 text-left font-medium">Client</th>
              <th className="text-muted-foreground px-4 py-3 text-left font-medium">Date</th>
              <th className="text-muted-foreground px-4 py-3 text-right font-medium">Items</th>
              <th className="text-muted-foreground px-4 py-3 text-right font-medium">Total</th>
              <th className="text-muted-foreground px-4 py-3 text-left font-medium">Submitted</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 && (
              <tr>
                <td colSpan={7} className="text-muted-foreground py-12 text-center">
                  No DSRs pending approval.
                </td>
              </tr>
            )}
            {entries.map((e) => (
              <tr key={e.id} className="hover:bg-muted/20 border-b transition-colors">
                <td className="px-4 py-3 font-medium">{e.submittedBy.name}</td>
                <td className="px-4 py-3">
                  <div>{e.client.companyName}</div>
                  {e.client.city && (
                    <div className="text-muted-foreground text-xs">{e.client.city}</div>
                  )}
                </td>
                <td className="px-4 py-3">{format(e.reportDate, 'MMM d, yyyy')}</td>
                <td className="px-4 py-3 text-right font-mono">{e._count.lineItems}</td>
                <td className="px-4 py-3 text-right font-mono font-medium">
                  PKR {Number(e.grandTotal).toLocaleString('en-PK')}
                </td>
                <td className="text-muted-foreground px-4 py-3 text-xs">
                  {format(e.createdAt, 'MMM d, HH:mm')}
                </td>
                <td className="px-4 py-3">
                  <Button size="sm" asChild>
                    <Link href={`/manager/dsr/${e.id}`}>
                      <Eye className="mr-1 h-4 w-4" />
                      Review
                    </Link>
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {total > pageSize && (
        <div className="flex justify-center gap-2">
          {page > 1 && (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/manager/dsr/pending?page=${page - 1}`}>Previous</Link>
            </Button>
          )}
          <span className="text-muted-foreground flex items-center text-sm">
            Page {page} of {Math.ceil(total / pageSize)}
          </span>
          {page < Math.ceil(total / pageSize) && (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/manager/dsr/pending?page=${page + 1}`}>Next</Link>
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
