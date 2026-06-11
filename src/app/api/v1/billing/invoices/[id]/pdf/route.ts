import { NextRequest, NextResponse } from 'next/server'
import { withTenantApi, apiError } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'
import { renderPlatformInvoicePdf } from '@/lib/pdf/platform-invoice-pdf'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withTenantApi(
    req,
    'billing:read',
    async ({ ctx }) => {
      const { id } = await params

      const invoice = await prisma.organizationInvoice.findFirst({
        where: { id, organizationId: ctx.organizationId, deletedAt: null },
      })
      if (!invoice) return apiError('Invoice not found', 404)

      const org = await prisma.organization.findUniqueOrThrow({
        where: { id: ctx.organizationId },
        select: { name: true, plan: true, billingEmail: true, email: true },
      })

      const pdfBuffer = await renderPlatformInvoicePdf({ invoice, org })

      return new NextResponse(new Uint8Array(pdfBuffer), {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${invoice.invoiceNumber}.pdf"`,
          'Cache-Control': 'private, max-age=3600',
        },
      })
    },
    { bypassSubscriptionCheck: true }
  )
}
