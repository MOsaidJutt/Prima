import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withTenantApi, apiOk, apiError } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'
import { createAuditLog } from '@/lib/audit'

const autoTopUpSchema = z.object({
  enabled: z.boolean(),
  threshold: z.number().int().min(0).optional(),
  packId: z.string().uuid().nullable().optional(),
})

export async function PATCH(req: NextRequest) {
  return withTenantApi(
    req,
    'billing:update',
    async ({ ctx }) => {
      try {
        const body = await req.json()
        const data = autoTopUpSchema.parse(body)

        if (data.packId) {
          const pack = await prisma.tokenTopUpPack.findUnique({ where: { id: data.packId } })
          if (!pack || !pack.isActive) return apiError('Selected top-up pack is not available.')
        }

        const before = await prisma.organization.findUniqueOrThrow({
          where: { id: ctx.organizationId },
          select: { autoTopUpEnabled: true, autoTopUpThreshold: true, autoTopUpPackId: true },
        })

        const org = await prisma.organization.update({
          where: { id: ctx.organizationId },
          data: {
            autoTopUpEnabled: data.enabled,
            ...(data.threshold !== undefined ? { autoTopUpThreshold: data.threshold } : {}),
            ...(data.packId !== undefined ? { autoTopUpPackId: data.packId } : {}),
          },
          select: { autoTopUpEnabled: true, autoTopUpThreshold: true, autoTopUpPackId: true },
        })

        await createAuditLog({
          organizationId: ctx.organizationId,
          userId: ctx.userId,
          action: 'UPDATE',
          entity: 'Billing',
          entityId: ctx.organizationId,
          oldValue: before,
          newValue: org,
          req,
        })

        return apiOk(org)
      } catch (err) {
        if (err instanceof z.ZodError) return apiError(err.errors[0].message)
        throw err
      }
    },
    { bypassSubscriptionCheck: true }
  )
}
