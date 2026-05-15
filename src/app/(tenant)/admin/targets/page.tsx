import { redirect } from 'next/navigation'
import { getTenantSession } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { PlusCircle } from 'lucide-react'
import { format } from 'date-fns'
import { hasPermission } from '@/lib/permissions'

function ProgressBar({ value, target }: { value: number; target: number }) {
  const pct = Math.min(100, target > 0 ? Math.round((value / target) * 100) : 0)
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs">
        <span className="text-muted-foreground">{pct}% achieved</span>
        <span className="text-muted-foreground font-mono">
          PKR {value.toLocaleString('en-PK')} / {Number(target).toLocaleString('en-PK')}
        </span>
      </div>
      <div className="bg-muted h-2 rounded-full">
        <div
          className={`h-2 rounded-full transition-all ${pct >= 100 ? 'bg-green-500' : pct >= 70 ? 'bg-accent' : pct >= 40 ? 'bg-amber-500' : 'bg-destructive'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

export default async function TargetsPage() {
  const session = await getTenantSession()
  if (!session) redirect('/login')

  const userWithRole = await prisma.user.findFirst({
    where: { id: session.userId, organizationId: session.organizationId, deletedAt: null },
    select: { role: { select: { permissions: true } } },
  })
  const perms = userWithRole?.role.permissions ?? []
  const canCreate = hasPermission(perms, 'targets:create')

  const targets = await prisma.salesTarget.findMany({
    where: { organizationId: session.organizationId, deletedAt: null },
    orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
    include: {
      user: { select: { name: true } },
      department: { select: { name: true } },
      product: { select: { name: true, sku: true } },
      client: { select: { companyName: true } },
    },
  })

  function scopeLabel(t: (typeof targets)[0]) {
    if (t.user) return `User: ${t.user.name}`
    if (t.department) return `Dept: ${t.department.name}`
    if (t.product) return `Product: ${t.product.name}`
    if (t.client) return `Client: ${t.client.companyName}`
    return 'Organization'
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Sales Targets</h1>
          <p className="text-muted-foreground">{targets.length} total targets</p>
        </div>
        {canCreate && (
          <Button asChild>
            <Link href="/admin/targets/new">
              <PlusCircle className="mr-2 h-4 w-4" />
              New Target
            </Link>
          </Button>
        )}
      </div>

      {targets.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground py-12 text-center">
            No targets defined yet.{' '}
            <Link href="/admin/targets/new" className="text-accent hover:underline">
              Create your first target.
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {targets.map((t) => (
            <Link key={t.id} href={`/admin/targets/${t.id}`}>
              <Card
                className={`hover:border-accent transition-colors ${!t.isActive ? 'opacity-60' : ''}`}
              >
                <CardContent className="space-y-3 pt-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold">{t.name}</p>
                      <p className="text-muted-foreground text-xs">{scopeLabel(t)}</p>
                    </div>
                    <div className="text-right text-xs">
                      <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5">
                        {t.type}
                      </span>
                    </div>
                  </div>
                  <ProgressBar value={Number(t.achievedValue)} target={Number(t.targetValue)} />
                  <div className="text-muted-foreground flex justify-between text-xs">
                    <span>{t.period}</span>
                    <span>
                      {format(t.periodStart, 'MMM d')} – {format(t.periodEnd, 'MMM d, yyyy')}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
