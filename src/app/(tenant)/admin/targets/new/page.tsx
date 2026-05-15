import { redirect } from 'next/navigation'
import { getTenantSession } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'
import { TargetForm } from '@/components/targets/target-form'

export default async function NewTargetPage() {
  const session = await getTenantSession()
  if (!session) redirect('/login')
  const orgId = session.organizationId

  const [users, departments, products, clients] = await Promise.all([
    prisma.user.findMany({
      where: { organizationId: orgId, isActive: true, deletedAt: null },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.department.findMany({
      where: { organizationId: orgId, deletedAt: null },
      select: { id: true, name: true },
    }),
    prisma.product.findMany({
      where: { organizationId: orgId, status: 'ACTIVE', deletedAt: null },
      select: { id: true, name: true, sku: true },
    }),
    prisma.client.findMany({
      where: { organizationId: orgId, status: 'ACTIVE', deletedAt: null },
      select: { id: true, companyName: true, code: true },
    }),
  ])

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">New Target</h1>
        <p className="text-muted-foreground">Set a measurable goal to track performance.</p>
      </div>
      <TargetForm users={users} departments={departments} products={products} clients={clients} />
    </div>
  )
}
