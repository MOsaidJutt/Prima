import { redirect, notFound } from 'next/navigation'
import { getTenantSession } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'
import { InvoiceTemplateEditor } from '@/components/invoice/template-editor'

export default async function EditTemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getTenantSession()
  if (!session) redirect('/login')

  const { id } = await params
  const template = await prisma.invoiceTemplate.findFirst({
    where: { id, organizationId: session.organizationId, deletedAt: null },
  })
  if (!template) notFound()

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Edit Template: {template.name}</h1>
      </div>
      <InvoiceTemplateEditor
        mode="edit"
        defaultValues={{
          ...template,
          primaryColor: template.primaryColor ?? undefined,
          accentColor: template.accentColor ?? undefined,
          headerHtml: template.headerHtml ?? undefined,
          footerHtml: template.footerHtml ?? undefined,
          logoUrl: template.logoUrl ?? undefined,
          bankDetails: (template.bankDetails as Record<string, string> | null) ?? undefined,
        }}
      />
    </div>
  )
}
