import { NextRequest } from 'next/server'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { withTenantApi, apiOk, apiError } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'
import { createAuditLog } from '@/lib/audit'

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  isDefault: z.boolean().optional(),
  headerHtml: z.string().optional().nullable(),
  footerHtml: z.string().optional().nullable(),
  logoUrl: z.string().optional().nullable(),
  primaryColor: z.string().optional().nullable(),
  accentColor: z.string().optional().nullable(),
  taxLabel: z.string().optional(),
  invoiceNumberPrefix: z.string().optional(),
  invoiceNumberPadding: z.number().int().min(1).max(8).optional(),
  invoiceNumberIncludeYear: z.boolean().optional(),
  bankDetailsEnabled: z.boolean().optional(),
  bankDetails: z.record(z.unknown()).optional().nullable(),
})

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withTenantApi(req, 'invoices:read', async ({ ctx }) => {
    const { id } = await params
    const template = await prisma.invoiceTemplate.findFirst({
      where: { id, organizationId: ctx.organizationId, deletedAt: null },
    })
    if (!template) return apiError('Template not found', 404)
    return apiOk(template)
  })
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withTenantApi(req, 'invoices:update', async ({ ctx, user }) => {
    const { id } = await params
    const template = await prisma.invoiceTemplate.findFirst({
      where: { id, organizationId: ctx.organizationId, deletedAt: null },
    })
    if (!template) return apiError('Template not found', 404)

    const body = await req.json()
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) return apiError(parsed.error.issues[0]?.message ?? 'Validation error')
    const d = parsed.data

    if (d.isDefault) {
      await prisma.invoiceTemplate.updateMany({
        where: {
          organizationId: ctx.organizationId,
          isDefault: true,
          deletedAt: null,
          id: { not: id },
        },
        data: { isDefault: false },
      })
    }

    const updated = await prisma.invoiceTemplate.update({
      where: { id },
      data: {
        ...d,
        bankDetails:
          d.bankDetails === null
            ? Prisma.JsonNull
            : d.bankDetails !== undefined
              ? (d.bankDetails as Prisma.InputJsonValue)
              : undefined,
        lastModifiedBy: user.id,
      },
    })

    await createAuditLog({
      organizationId: ctx.organizationId,
      userId: user.id,
      action: 'UPDATE',
      entity: 'InvoiceTemplate',
      entityId: id,
      req,
    })
    return apiOk(updated)
  })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withTenantApi(req, 'invoices:delete', async ({ ctx, user }) => {
    const { id } = await params
    const template = await prisma.invoiceTemplate.findFirst({
      where: { id, organizationId: ctx.organizationId, deletedAt: null },
    })
    if (!template) return apiError('Template not found', 404)
    if (template.isDefault) return apiError('Cannot delete the default template', 422)

    await prisma.invoiceTemplate.update({
      where: { id },
      data: { deletedAt: new Date(), lastModifiedBy: user.id },
    })
    await createAuditLog({
      organizationId: ctx.organizationId,
      userId: user.id,
      action: 'DELETE',
      entity: 'InvoiceTemplate',
      entityId: id,
      req,
    })
    return apiOk({ success: true })
  })
}
