import { redirect } from 'next/navigation'
import { getTenantSession } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'
import { DSRForm } from '@/components/dsr/dsr-form'

export default async function NewDSRPage() {
  const session = await getTenantSession()
  if (!session) redirect('/login')

  const [clients, products] = await Promise.all([
    prisma.client.findMany({
      where: { organizationId: session.organizationId, status: 'ACTIVE', deletedAt: null },
      orderBy: { companyName: 'asc' },
      select: { id: true, companyName: true, code: true, city: true, lastOrderDate: true },
    }),
    prisma.product.findMany({
      where: { organizationId: session.organizationId, status: 'ACTIVE', deletedAt: null },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        sku: true,
        sellingPrice: true,
        taxRate: true,
        unitOfMeasure: true,
      },
    }),
  ])

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Submit Daily Sales Report</h1>
        <p className="text-muted-foreground">Record your client visit and sales for the day.</p>
      </div>
      <DSRForm clients={clients} products={products} mode="create" />
    </div>
  )
}
