import { prisma } from '@/lib/prisma'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus, ShieldCheck, Shield } from 'lucide-react'
import Link from 'next/link'

export const metadata = { title: 'Admins' }

export default async function AdminsPage() {
  const admins = await prisma.superAdmin.findMany({ orderBy: { createdAt: 'asc' } })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Super Admins</h1>
          <p className="text-muted-foreground">{admins.length} admins</p>
        </div>
        <Button asChild>
          <Link href="/super-admin/admins/new">
            <Plus className="mr-2 h-4 w-4" /> New Admin
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Admins</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b">
                <th className="text-muted-foreground px-4 py-3 text-left font-medium">Name</th>
                <th className="text-muted-foreground px-4 py-3 text-left font-medium">Email</th>
                <th className="text-muted-foreground px-4 py-3 text-left font-medium">Role</th>
                <th className="text-muted-foreground px-4 py-3 text-left font-medium">Status</th>
                <th className="text-muted-foreground px-4 py-3 text-left font-medium">
                  Last Login
                </th>
              </tr>
            </thead>
            <tbody>
              {admins.map((admin) => (
                <tr key={admin.id} className="hover:bg-muted/30 border-b">
                  <td className="flex items-center gap-2 px-4 py-3">
                    {admin.role === 'OWNER' ? (
                      <ShieldCheck className="text-primary h-4 w-4" />
                    ) : (
                      <Shield className="text-muted-foreground h-4 w-4" />
                    )}
                    <span className="font-medium">{admin.name}</span>
                  </td>
                  <td className="text-muted-foreground px-4 py-3">{admin.email}</td>
                  <td className="px-4 py-3">
                    <Badge variant={admin.role === 'OWNER' ? 'default' : 'secondary'}>
                      {admin.role}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={admin.isActive ? 'success' : 'outline'}>
                      {admin.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </td>
                  <td className="text-muted-foreground px-4 py-3">
                    {admin.lastLoginAt ? new Date(admin.lastLoginAt).toLocaleDateString() : 'Never'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}
