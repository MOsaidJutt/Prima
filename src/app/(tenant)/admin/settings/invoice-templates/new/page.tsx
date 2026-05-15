import { redirect } from 'next/navigation'
import { getTenantSession } from '@/lib/auth/session'
import { InvoiceTemplateEditor } from '@/components/invoice/template-editor'

export default async function NewTemplatePage() {
  const session = await getTenantSession()
  if (!session) redirect('/login')
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">New Invoice Template</h1>
        <p className="text-muted-foreground">
          Design how your invoices look and set the numbering format.
        </p>
      </div>
      <InvoiceTemplateEditor mode="create" />
    </div>
  )
}
