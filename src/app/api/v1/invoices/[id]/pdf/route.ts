import { NextRequest, NextResponse } from 'next/server'
import { withTenantApi, apiError } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'
import { renderInvoicePdf } from '@/lib/pdf/invoice-pdf'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withTenantApi(req, 'invoices:read', async ({ ctx }) => {
    const { id } = await params
    const invoice = await prisma.invoice.findFirst({
      where: { id, organizationId: ctx.organizationId, deletedAt: null },
      include: {
        client: true,
        template: true,
        lineItems: {
          orderBy: { sortOrder: 'asc' },
          include: { product: { select: { name: true, sku: true } } },
        },
      },
    })
    if (!invoice) return apiError('Invoice not found', 404)

    const org = await prisma.organization.findFirst({
      where: { id: ctx.organizationId },
      select: {
        name: true,
        address: true,
        city: true,
        phone: true,
        email: true,
        ntn: true,
        logoLight: true,
      },
    })

    const pdfBuffer = await renderInvoicePdf({ invoice, org })

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="invoice-${invoice.invoiceNumber}.pdf"`,
        'Cache-Control': 'private, max-age=3600',
      },
    })
  })
}
