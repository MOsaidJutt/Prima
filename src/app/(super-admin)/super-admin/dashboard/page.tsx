import { prisma } from '@/lib/prisma'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Building2, Users, TrendingUp, AlertCircle } from 'lucide-react'

export const metadata = { title: 'Platform Dashboard' }

async function getStats() {
  // M-1: filter deletedAt: null — soft-cancelled orgs must not inflate counts
  const [totalOrgs, activeOrgs, trialOrgs, suspendedOrgs] = await Promise.all([
    prisma.organization.count({ where: { deletedAt: null } }),
    prisma.organization.count({ where: { status: 'ACTIVE', deletedAt: null } }),
    prisma.organization.count({ where: { status: 'TRIAL', deletedAt: null } }),
    prisma.organization.count({ where: { status: 'SUSPENDED', deletedAt: null } }),
  ])
  return { totalOrgs, activeOrgs, trialOrgs, suspendedOrgs }
}

export default async function SuperAdminDashboardPage() {
  const stats = await getStats()

  const cards = [
    {
      label: 'Total Organizations',
      value: stats.totalOrgs,
      icon: Building2,
      color: 'text-blue-600',
    },
    { label: 'Active', value: stats.activeOrgs, icon: TrendingUp, color: 'text-green-600' },
    { label: 'On Trial', value: stats.trialOrgs, icon: Users, color: 'text-yellow-600' },
    { label: 'Suspended', value: stats.suspendedOrgs, icon: AlertCircle, color: 'text-red-600' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Platform Dashboard</h1>
        <p className="text-muted-foreground">Overview of all tenant organizations</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-muted-foreground text-sm font-medium">{c.label}</CardTitle>
              <c.icon className={`h-5 w-5 ${c.color}`} />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{c.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
