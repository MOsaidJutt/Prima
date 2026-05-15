import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withTenantApi, apiOk, apiError } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'
import { createAuditLog } from '@/lib/audit'

const schema = z.object({
  reason: z.string().min(1, 'Rejection reason is required'),
})

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withTenantApi(req, 'dsr:reject', async ({ ctx, user }) => {
    const { id } = await params
    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) return apiError(parsed.error.issues[0]?.message ?? 'Validation error')

    const entry = await prisma.dSREntry.findFirst({
      where: { id, organizationId: ctx.organizationId, deletedAt: null },
    })
    if (!entry) return apiError('DSR not found', 404)
    if (entry.status !== 'SUBMITTED') return apiError('DSR is not in SUBMITTED state', 422)

    const updated = await prisma.dSREntry.update({
      where: { id },
      data: {
        status: 'REJECTED',
        approvedById: user.id,
        approvedAt: new Date(),
        rejectionReason: parsed.data.reason,
        lastModifiedBy: user.id,
      },
    })

    await createAuditLog({
      organizationId: ctx.organizationId,
      userId: user.id,
      action: 'UPDATE',
      entity: 'DSREntry',
      entityId: id,
      newValue: { status: 'REJECTED', reason: parsed.data.reason },
      req,
    })

    return apiOk(updated)
  })
}
