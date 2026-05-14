import { NextRequest } from 'next/server'
import { z } from 'zod'
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
  ntn: z.string().optional(),
  strn: z.string().optional(),
  distributorId: z.string().uuid().nullable().optional(),
  assignedRepId: z.string().uuid().nullable().optional(),
  businessType: z
    .enum(['RETAIL', 'WHOLESALE', 'DISTRIBUTOR', 'MANUFACTURER', 'SERVICE', 'OTHER'])
    .optional(),
  businessSize: z.enum(['SMALL', 'MEDIUM', 'LARGE', 'ENTERPRISE']).optional(),
  industry: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'PROSPECT', 'CHURNED']).optional(),
  creditLimit: z.number().min(0).optional(),
  paymentTerms: z.number().min(0).optional(),
  tags: z.array(z.string()).optional(),
  notes: z.string().optional(),
})

type Params = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: Params) {
  return withTenantApi(req, 'clients:read', async ({ ctx }) => {
    const { id } = await params
    const client = await prisma.client.findFirst({
      where: { id, organizationId: ctx.organizationId, deletedAt: null },
      include: {
        distributor: { select: { id: true, code: true, companyName: true } },
        assignedRep: { select: { id: true, name: true, email: true } },
        attachments: { where: { deletedAt: null }, orderBy: { createdAt: 'desc' } },
      },
    })
    if (!client) return apiError('Client not found', 404)
    return apiOk(client)
  })
}

export async function PATCH(req: NextRequest, { params }: Params) {
  return withTenantApi(req, 'clients:update', async ({ ctx, user }) => {
    const { id } = await params
    const body = await req.json()
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) return apiError(parsed.error.issues[0].message)

    const old = await prisma.client.findFirst({
      where: { id, organizationId: ctx.organizationId, deletedAt: null },
    })
    if (!old) return apiError('Client not found', 404)

    // C-1: organizationId in the write WHERE
    const updated = await prisma.client.update({
      where: { id, organizationId: ctx.organizationId },
      data: { ...parsed.data, lastModifiedBy: user.id },
    })
    await createAuditLog({
      organizationId: ctx.organizationId,
      userId: user.id,
      action: 'UPDATE',
      entity: 'Client',
      entityId: id,
      oldValue: old,
      newValue: updated,
      req,
    })
    return apiOk(updated)
  })
}

export async function DELETE(req: NextRequest, { params }: Params) {
  return withTenantApi(req, 'clients:delete', async ({ ctx, user }) => {
    const { id } = await params
    const client = await prisma.client.findFirst({
      where: { id, organizationId: ctx.organizationId, deletedAt: null },
    })
    if (!client) return apiError('Client not found', 404)

    // C-1: organizationId in the write WHERE
    await prisma.client.update({
      where: { id, organizationId: ctx.organizationId },
      data: { deletedAt: new Date(), lastModifiedBy: user.id },
    })
    // M-5: capture oldValue; L-3: pass req
    await createAuditLog({
      organizationId: ctx.organizationId,
      userId: user.id,
      action: 'DELETE',
      entity: 'Client',
      entityId: id,
      oldValue: client,
      req,
    })
    return apiOk({ success: true })
  })
}
