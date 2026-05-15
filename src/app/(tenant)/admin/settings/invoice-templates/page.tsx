import { redirect } from 'next/navigation'
import { getTenantSession } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PlusCircle, Pencil, Star } from 'lucide-react'
import { hasPermission } from '@/lib/permissions'

export default async function InvoiceTemplatesPage() {
  const session = await getTenantSession()
  if (!session) redirect('/login')

  const userWithRole = await prisma.user.findFirst({
    where: { id: session.userId, organizationId: session.organizationId, deletedAt: null },
    select: { role: { select: { permissions: true } } },
  })
  const perms = userWithRole?.role.permissions ?? []
  const canCreate = hasPermission(perms, 'invoices:create')
  const canEdit = hasPermission(perms, 'invoices:update')

  const templates = await prisma.invoiceTemplate.findMany({
    where: { organizationId: session.organizationId, deletedAt: null },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
  })

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Invoice Templates</h1>
          <p className="text-muted-foreground">Customize how your invoices look.</p>
        </div>
        {canCreate && (
          <Button asChild>
            <Link href="/admin/settings/invoice-templates/new">
              <PlusCircle className="mr-2 h-4 w-4" />
              New Template
            </Link>
          </Button>
        )}
      </div>

      {templates.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground py-12 text-center">
            No templates yet.{' '}
            <Link
              href="/admin/settings/invoice-templates/new"
              className="text-accent hover:underline"
            >
              Create your first one.
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((t) => (
            <Card key={t.id} className="relative">
              <CardContent className="pt-6">
                <div className="mb-3 flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">{t.name}</p>
                      {t.isDefault && (
                        <Badge variant="default" className="text-xs">
                          <Star className="mr-1 h-3 w-3" />
                          Default
                        </Badge>
                      )}
                    </div>
                    <p className="text-muted-foreground mt-1 text-xs">
                      {t.invoiceNumberPrefix}-{t.invoiceNumberIncludeYear ? '{YYYY}-' : ''}
                      {'{' + '0'.repeat(t.invoiceNumberPadding) + '}'}
                    </p>
                  </div>
                  {t.primaryColor && (
                    <div
                      className="h-6 w-6 rounded-full border"
                      style={{ backgroundColor: t.primaryColor }}
                    />
                  )}
                </div>
                <div className="text-muted-foreground mb-4 flex items-center gap-2 text-xs">
                  <span>{t.taxLabel}</span>
                  {t.bankDetailsEnabled && <span>· Bank details</span>}
                </div>
                {canEdit && (
                  <Button variant="outline" size="sm" className="w-full" asChild>
                    <Link href={`/admin/settings/invoice-templates/${t.id}/edit`}>
                      <Pencil className="mr-2 h-3 w-3" />
                      Edit
                    </Link>
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
