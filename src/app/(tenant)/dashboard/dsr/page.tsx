import { redirect } from 'next/navigation'
import { getTenantSession } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PlusCircle } from 'lucide-react'
import { format } from 'date-fns'
import { DataTable } from '@/components/data-table'

export default async function MyDSRsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: string }>
}) {
  const session = await getTenantSession()
  if (!session) redirect('/login')

  const sp = await searchParams
  const page = Math.max(1, Number(sp.page ?? 1))
  const pageSize = 25
  const status = sp.status ?? ''

  const where = {
    organizationId: session.organizationId,
    submittedById: session.userId,
    deletedAt: null,
    ...(status ? { status: status as 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' } : {}),
  }

  const [entries, total] = await Promise.all([
    prisma.dSREntry.findMany({
      where,
      orderBy: { reportDate: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        client: { select: { companyName: true, city: true } },
        _count: { select: { lineItems: true } },
      },
    }),
    prisma.dSREntry.count({ where }),
  ])

  const statusVariant = (s: string) =>
    ({ DRAFT: 'secondary', SUBMITTED: 'outline', APPROVED: 'default', REJECTED: 'destructive' })[
      s
    ] ?? 'secondary'

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">My DSRs</h1>
          <p className="text-muted-foreground">{total} total reports</p>
        </div>
        <Button asChild>
          <Link href="/dashboard/dsr/new">
            <PlusCircle className="mr-2 h-4 w-4" />
            New DSR
          </Link>
        </Button>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-2">
        {['', 'DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED'].map((s) => (
          <Link key={s} href={s ? `/dashboard/dsr?status=${s}` : '/dashboard/dsr'}>
            <Button variant={status === s ? 'default' : 'outline'} size="sm">
              {s || 'All'}
            </Button>
          </Link>
        ))}
      </div>

      <div className="rounded-md border">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/40 border-b">
              <th className="text-muted-foreground px-4 py-3 text-left font-medium">Date</th>
              <th className="text-muted-foreground px-4 py-3 text-left font-medium">Client</th>
              <th className="text-muted-foreground px-4 py-3 text-left font-medium">Visit Type</th>
              <th className="text-muted-foreground px-4 py-3 text-right font-medium">Items</th>
              <th className="text-muted-foreground px-4 py-3 text-right font-medium">Total</th>
              <th className="text-muted-foreground px-4 py-3 text-center font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 && (
              <tr>
                <td colSpan={6} className="text-muted-foreground py-12 text-center">
                  No DSRs found.
                </td>
              </tr>
            )}
            {entries.map((e) => (
              <tr key={e.id} className="hover:bg-muted/20 border-b transition-colors">
                <td className="px-4 py-3">
                  <Link href={`/dashboard/dsr/${e.id}`} className="hover:text-accent">
                    {format(e.reportDate, 'MMM d, yyyy')}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium">{e.client.companyName}</div>
                  {e.client.city && (
                    <div className="text-muted-foreground text-xs">{e.client.city}</div>
                  )}
                </td>
                <td className="px-4 py-3 capitalize">
                  {e.visitType.replace('_', ' ').toLowerCase()}
                </td>
                <td className="px-4 py-3 text-right font-mono">{e._count.lineItems}</td>
                <td className="px-4 py-3 text-right font-mono">
                  PKR {Number(e.grandTotal).toLocaleString('en-PK')}
                </td>
                <td className="px-4 py-3 text-center">
                  <Badge
                    variant={
                      statusVariant(e.status) as 'default' | 'secondary' | 'outline' | 'destructive'
                    }
                  >
                    {e.status}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {total > pageSize && (
        <div className="flex justify-center gap-2">
          {page > 1 && (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/dashboard/dsr?page=${page - 1}${status ? `&status=${status}` : ''}`}>
                Previous
              </Link>
            </Button>
          )}
          <span className="text-muted-foreground flex items-center text-sm">
            Page {page} of {Math.ceil(total / pageSize)}
          </span>
          {page < Math.ceil(total / pageSize) && (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/dashboard/dsr?page=${page + 1}${status ? `&status=${status}` : ''}`}>
                Next
              </Link>
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
