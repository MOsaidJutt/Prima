import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import type { OrgStatus } from '@prisma/client'

export const metadata = { title: 'Organizations' }

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

export default async function OrganizationsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const { q } = await searchParams

  const orgs = await prisma.organization.findMany({
    where: q
      ? {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { slug: { contains: q, mode: 'insensitive' } },
            { email: { contains: q, mode: 'insensitive' } },
          ],
        }
      : undefined,
    orderBy: { createdAt: 'desc' },
    take: 50,
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Organizations</h1>
          <p className="text-muted-foreground">{orgs.length} tenants</p>
        </div>
        <Button asChild>
          <Link href="/super-admin/organizations/new">
            <Plus className="mr-2 h-4 w-4" />
            New Organization
          </Link>
        </Button>
      </div>

      <form method="GET" className="flex gap-2">
        <div className="relative max-w-sm flex-1">
          <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <Input
            name="q"
            defaultValue={q}
            placeholder="Search by name, slug, email…"
            className="pl-9"
          />
        </div>
        <Button type="submit" variant="secondary">
          Search
        </Button>
      </form>

      <Card>
        <CardHeader>
          <CardTitle>All Organizations</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b">
                  <th className="text-muted-foreground px-4 py-3 text-left font-medium">Name</th>
                  <th className="text-muted-foreground px-4 py-3 text-left font-medium">Slug</th>
                  <th className="text-muted-foreground px-4 py-3 text-left font-medium">Plan</th>
                  <th className="text-muted-foreground px-4 py-3 text-left font-medium">Status</th>
                  <th className="text-muted-foreground px-4 py-3 text-left font-medium">Created</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {orgs.map((org) => (
                  <tr key={org.id} className="hover:bg-muted/30 border-b transition-colors">
                    <td className="px-4 py-3 font-medium">{org.name}</td>
                    <td className="text-muted-foreground px-4 py-3 font-mono text-xs">
                      {org.slug}
                    </td>
                    <td className="px-4 py-3">{org.plan}</td>
                    <td className="px-4 py-3">
                      <Badge variant={statusVariant[org.status]}>{org.status}</Badge>
                    </td>
                    <td className="text-muted-foreground px-4 py-3">
                      {new Date(org.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/super-admin/organizations/${org.id}`}>View</Link>
                      </Button>
                    </td>
                  </tr>
                ))}
                {orgs.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-muted-foreground px-4 py-8 text-center">
                      No organizations found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
