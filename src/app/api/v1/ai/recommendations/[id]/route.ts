import { NextRequest } from 'next/server'
import { withTenantApi, apiOk, apiError } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const actionSchema = z.object({
  action: z.enum(['acknowledge', 'dismiss', 'act_on']),
})

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withTenantApi(req, null, async ({ ctx, user }) => {
    const { id } = await params
    const body = await req.json()
    const parsed = actionSchema.safeParse(body)
    if (!parsed.success) return apiError('Invalid action')

    const { action } = parsed.data
    const now = new Date()

    const statusMap = {
      acknowledge: 'ACKNOWLEDGED',
      dismiss: 'DISMISSED',
      act_on: 'ACTED_ON',
    } as const
    const updateMap = {
      acknowledge: { acknowledgedAt: now, acknowledgedBy: user.id },
      dismiss: { dismissedAt: now, dismissedBy: user.id },
      act_on: { actedOnAt: now, actedOnBy: user.id },
    }

    await prisma.aIRecommendation.update({
      where: { id, organizationId: ctx.organizationId },
      data: { status: statusMap[action], ...updateMap[action] },
    })

    return apiOk({ ok: true })
  })
}
