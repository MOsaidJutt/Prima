import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withTenantApi, apiOk, apiError } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'
import { createAuditLog } from '@/lib/audit'

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  targetValue: z.number().positive().optional(),
  achievedValue: z.number().min(0).optional(),
  periodStart: z.string().datetime().optional(),
  periodEnd: z.string().datetime().optional(),
  isActive: z.boolean().optional(),
})

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withTenantApi(req, 'targets:read', async ({ ctx }) => {
    const { id } = await params
    const target = await prisma.salesTarget.findFirst({
      where: { id, organizationId: ctx.organizationId, deletedAt: null },
      include: {
        user: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
        product: { select: { id: true, name: true, sku: true } },
        client: { select: { id: true, companyName: true, code: true } },
      },
    })
    if (!target) return apiError('Target not found', 404)
    return apiOk(target)
  })
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withTenantApi(req, 'targets:update', async ({ ctx, user }) => {
    const { id } = await params
    const target = await prisma.salesTarget.findFirst({
      where: { id, organizationId: ctx.organizationId, deletedAt: null },
    })
    if (!target) return apiError('Target not found', 404)

    const body = await req.json()
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) return apiError(parsed.error.issues[0]?.message ?? 'Validation error')
    const d = parsed.data

    const updated = await prisma.salesTarget.update({
      where: { id },
      data: {
        ...(d.name ? { name: d.name } : {}),
        ...(d.targetValue !== undefined ? { targetValue: d.targetValue } : {}),
        ...(d.achievedValue !== undefined ? { achievedValue: d.achievedValue } : {}),
        ...(d.periodStart ? { periodStart: new Date(d.periodStart) } : {}),
        ...(d.periodEnd ? { periodEnd: new Date(d.periodEnd) } : {}),
        ...(d.isActive !== undefined ? { isActive: d.isActive } : {}),
        lastModifiedBy: user.id,
      },
    })

    await createAuditLog({
      organizationId: ctx.organizationId,
      userId: user.id,
      action: 'UPDATE',
      entity: 'SalesTarget',
      entityId: id,
      req,
    })
    return apiOk(updated)
  })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withTenantApi(req, 'targets:delete', async ({ ctx, user }) => {
    const { id } = await params
    const target = await prisma.salesTarget.findFirst({
      where: { id, organizationId: ctx.organizationId, deletedAt: null },
    })
    if (!target) return apiError('Target not found', 404)

    await prisma.salesTarget.update({
      where: { id },
      data: { deletedAt: new Date(), lastModifiedBy: user.id },
    })
    await createAuditLog({
      organizationId: ctx.organizationId,
      userId: user.id,
      action: 'DELETE',
      entity: 'SalesTarget',
      entityId: id,
      req,
    })
    return apiOk({ success: true })
  })
}
