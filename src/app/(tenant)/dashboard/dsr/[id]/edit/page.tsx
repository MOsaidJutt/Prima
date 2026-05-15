import { redirect, notFound } from 'next/navigation'
import { getTenantSession } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'
import { DSRForm } from '@/components/dsr/dsr-form'

export default async function EditDSRPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getTenantSession()
  if (!session) redirect('/login')

  const { id } = await params
  const entry = await prisma.dSREntry.findFirst({
    where: {
      id,
      organizationId: session.organizationId,
      submittedById: session.userId,
      deletedAt: null,
    },
    include: { lineItems: { include: { product: true } } },
  })
  if (!entry) notFound()
  if (entry.status !== 'DRAFT') redirect(`/dashboard/dsr/${id}`)

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
        <h1 className="text-2xl font-bold">Edit DSR</h1>
        <p className="text-muted-foreground">Update your draft report before submitting.</p>
      </div>
      <DSRForm clients={clients} products={products} mode="edit" defaultValues={entry} />
    </div>
  )
}
