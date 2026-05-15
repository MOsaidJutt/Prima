import { NextRequest } from 'next/server'
import { withTenantApi, apiOk, apiError } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'
import { createAuditLog } from '@/lib/audit'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withTenantApi(req, 'dsr:create', async ({ ctx, user }) => {
    const { id } = await params
    const entry = await prisma.dSREntry.findFirst({
      where: { id, organizationId: ctx.organizationId, deletedAt: null },
    })
    if (!entry) return apiError('DSR not found', 404)
    if (entry.submittedById !== user.id) return apiError('Forbidden', 403)
    if (entry.status !== 'DRAFT') return apiError('Only DRAFT DSRs can be submitted', 422)

    const updated = await prisma.dSREntry.update({
      where: { id },
      data: { status: 'SUBMITTED', lastModifiedBy: user.id },
    })

    await createAuditLog({
      organizationId: ctx.organizationId,
      userId: user.id,
      action: 'UPDATE',
      entity: 'DSREntry',
      entityId: id,
      newValue: { status: 'SUBMITTED' },
      req,
    })

    return apiOk(updated)
  })
}
