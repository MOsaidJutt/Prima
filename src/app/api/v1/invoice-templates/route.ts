import { NextRequest } from 'next/server'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { withTenantApi, apiOk, apiError } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'
import { createAuditLog } from '@/lib/audit'

const createSchema = z.object({
  name: z.string().min(1),
  isDefault: z.boolean().default(false),
  headerHtml: z.string().optional(),
  footerHtml: z.string().optional(),
  logoUrl: z.string().optional(),
  primaryColor: z.string().optional(),
  accentColor: z.string().optional(),
  taxLabel: z.string().default('GST'),
  invoiceNumberPrefix: z.string().default('INV'),
  invoiceNumberPadding: z.number().int().min(1).max(8).default(4),
  invoiceNumberIncludeYear: z.boolean().default(true),
  bankDetailsEnabled: z.boolean().default(false),
  bankDetails: z.record(z.unknown()).optional(),
})

export async function GET(req: NextRequest) {
  return withTenantApi(req, 'invoices:read', async ({ ctx }) => {
    const templates = await prisma.invoiceTemplate.findMany({
      where: { organizationId: ctx.organizationId, deletedAt: null },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    })
    return apiOk(templates)
  })
}

export async function POST(req: NextRequest) {
  return withTenantApi(req, 'invoices:create', async ({ ctx, user }) => {
    const body = await req.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) return apiError(parsed.error.issues[0]?.message ?? 'Validation error')
    const d = parsed.data

    // If setting as default, clear existing default
    if (d.isDefault) {
      await prisma.invoiceTemplate.updateMany({
        where: { organizationId: ctx.organizationId, isDefault: true, deletedAt: null },
        data: { isDefault: false },
      })
    }

    const template = await prisma.invoiceTemplate.create({
      data: {
        organizationId: ctx.organizationId,
        ...d,
        bankDetails: d.bankDetails ? (d.bankDetails as Prisma.InputJsonValue) : undefined,
        lastModifiedBy: user.id,
      },
    })

    await createAuditLog({
      organizationId: ctx.organizationId,
      userId: user.id,
      action: 'CREATE',
      entity: 'InvoiceTemplate',
      entityId: template.id,
      req,
    })

    return apiOk(template, 201)
  })
}
