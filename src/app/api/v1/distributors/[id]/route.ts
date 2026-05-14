import { NextRequest } from 'next/server'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { withTenantApi, apiOk, apiError } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'
import { createAuditLog } from '@/lib/audit'

const updateSchema = z.object({
  companyName: z.string().min(1).optional(),
  contactName: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  phone2: z.string().optional(),
  website: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  postalCode: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  ntn: z.string().optional(),
  strn: z.string().optional(),
  bankName: z.string().optional(),
  bankAccount: z.string().optional(),
  bankBranch: z.string().optional(),
  iban: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'BLACKLISTED']).optional(),
  tier: z.enum(['GOLD', 'SILVER', 'BRONZE']).optional(),
  creditLimit: z.number().min(0).optional(),
  paymentTerms: z.number().min(0).optional(),
  tags: z.array(z.string()).optional(),
  notes: z.string().optional(),
})

type Params = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: Params) {
  return withTenantApi(req, 'distributors:read', async ({ ctx }) => {
    const { id } = await params
    const distributor = await prisma.distributor.findFirst({
      where: { id, organizationId: ctx.organizationId, deletedAt: null },
      include: {
        clients: {
          where: { deletedAt: null },
          select: {
            id: true,
            code: true,
            companyName: true,
            status: true,
            city: true,
            lastOrderDate: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 20, // H-5: paginate; full list via /admin/clients?distributorId=
        },
        attachments: { where: { deletedAt: null }, orderBy: { createdAt: 'desc' } },
        inventoryTransactions: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          include: {
            product: { select: { name: true, sku: true } },
            toWarehouse: { select: { name: true } },
          },
        },
      },
    })
    if (!distributor) return apiError('Distributor not found', 404)
    return apiOk(distributor)
  })
}

export async function PATCH(req: NextRequest, { params }: Params) {
  return withTenantApi(req, 'distributors:update', async ({ ctx, user }) => {
    const { id } = await params
    const body = await req.json()
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) return apiError(parsed.error.issues[0].message)

    const old = await prisma.distributor.findFirst({
      where: { id, organizationId: ctx.organizationId, deletedAt: null },
    })
    if (!old) return apiError('Distributor not found', 404)

    // C-1: organizationId in the write WHERE, not just the pre-check
    const updated = await prisma.distributor.update({
      where: { id, organizationId: ctx.organizationId },
      data: { ...parsed.data, lastModifiedBy: user.id },
    })

    await createAuditLog({
      organizationId: ctx.organizationId,
      userId: user.id,
      action: 'UPDATE',
      entity: 'Distributor',
      entityId: id,
      oldValue: old,
      newValue: updated,
      req,
    })
    return apiOk(updated)
  })
}

export async function DELETE(req: NextRequest, { params }: Params) {
  return withTenantApi(req, 'distributors:delete', async ({ ctx, user }) => {
    const { id } = await params
    const distributor = await prisma.distributor.findFirst({
      where: { id, organizationId: ctx.organizationId, deletedAt: null },
    })
    if (!distributor) return apiError('Distributor not found', 404)

    // C-1: organizationId in the write WHERE
    await prisma.distributor.update({
      where: { id, organizationId: ctx.organizationId },
      data: { deletedAt: new Date(), lastModifiedBy: user.id },
    })
    // M-5: capture oldValue on delete; L-3: pass req
    await createAuditLog({
      organizationId: ctx.organizationId,
      userId: user.id,
      action: 'DELETE',
      entity: 'Distributor',
      entityId: id,
      oldValue: distributor,
      req,
    })
    return apiOk({ success: true })
  })
}
