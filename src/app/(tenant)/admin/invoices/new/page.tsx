import { redirect } from 'next/navigation'
import { getTenantSession } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'
import { InvoiceForm } from '@/components/invoice/invoice-form'

export default async function NewInvoicePage({
  searchParams,
}: {
  searchParams: Promise<{ dsrId?: string }>
}) {
  const session = await getTenantSession()
  if (!session) redirect('/login')

  const sp = await searchParams
  const orgId = session.organizationId

  const [clients, products, templates, dsrData] = await Promise.all([
    prisma.client.findMany({
      where: { organizationId: orgId, status: 'ACTIVE', deletedAt: null },
      orderBy: { companyName: 'asc' },
      select: { id: true, companyName: true, code: true, paymentTerms: true },
    }),
    prisma.product.findMany({
      where: { organizationId: orgId, status: 'ACTIVE', deletedAt: null },
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
    prisma.invoiceTemplate.findMany({
      where: { organizationId: orgId, deletedAt: null },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
      select: { id: true, name: true, isDefault: true },
    }),
    // Pre-fill from DSR if dsrId provided
    sp.dsrId
      ? prisma.dSREntry.findFirst({
          where: { id: sp.dsrId, organizationId: orgId, status: 'APPROVED', deletedAt: null },
          include: {
            lineItems: { include: { product: { select: { name: true } } } },
          },
        })
      : null,
  ])

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">New Invoice</h1>
        <p className="text-muted-foreground">
          Create a new invoice manually or from an approved DSR.
        </p>
      </div>
      <InvoiceForm
        clients={clients}
        products={products}
        templates={templates}
        prefillDSR={dsrData ?? null}
      />
    </div>
  )
}
