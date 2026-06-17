import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { OrgStatusActions } from './org-status-actions'
import type { OrgStatus } from '@prisma/client'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

const statusVariant: Record<
  OrgStatus,
  'success' | 'warning' | 'destructive' | 'secondary' | 'outline'
> = {
  ACTIVE: 'success',
  TRIAL: 'warning',
  PAST_DUE: 'destructive',
  SUSPENDED: 'destructive',
  CANCELLED: 'outline',
}

export default async function OrgDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const org = await prisma.organization.findUnique({
    where: { id },
    include: { invoices: { take: 5, orderBy: { createdAt: 'desc' } } },
  })
  if (!org) notFound()

  const rows: [string, string][] = [
    ['Email', org.email],
    ['Phone', org.phone ?? '—'],
    ['City', org.city ?? '—'],
    ['Country', org.country],
    ['Plan', org.plan],
    ['Onboarding', org.onboardingCompleted ? 'Complete' : `Step ${org.onboardingStep}`],
    ['AI Enabled', org.aiEnabled ? 'Yes' : 'No'],
    ['Created', new Date(org.createdAt).toLocaleDateString()],
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" aria-label="Back to organizations" asChild>
          <Link href="/super-admin/organizations">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{org.name}</h1>
            <Badge variant={statusVariant[org.status]}>{org.status}</Badge>
          </div>
          <p className="text-muted-foreground font-mono text-sm">{org.slug}</p>
        </div>
        <Button variant="outline" asChild>
          <Link href={`/super-admin/organizations/${org.id}/billing`}>Billing</Link>
        </Button>
        <OrgStatusActions orgId={org.id} currentStatus={org.status} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3">
              {rows.map(([label, value]) => (
                <div key={label} className="flex justify-between text-sm">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="font-medium">{value}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Invoices</CardTitle>
          </CardHeader>
          <CardContent>
            {org.invoices.length === 0 ? (
              <p className="text-muted-foreground text-sm">No invoices yet.</p>
            ) : (
              <ul className="space-y-2">
                {org.invoices.map((inv) => (
                  <li key={inv.id} className="flex justify-between text-sm">
                    <span className="font-mono">{inv.invoiceNumber}</span>
                    <span className="text-muted-foreground">{inv.status}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
