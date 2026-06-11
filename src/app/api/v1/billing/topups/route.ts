import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withTenantApi, apiOk, apiError } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'
import { purchaseTopUp, TopUpError } from '@/lib/billing/topup'

const purchaseSchema = z.object({
  packId: z.string().uuid(),
})

export async function GET(req: NextRequest) {
  return withTenantApi(
    req,
    'billing:read',
    async ({ ctx }) => {
      const url = new URL(req.url)
      const page = Math.max(1, Number(url.searchParams.get('page') ?? 1))
      const pageSize = 20

      const where = { organizationId: ctx.organizationId }
      const [orders, total] = await Promise.all([
        prisma.tokenTopUpOrder.findMany({
          where,
          include: { pack: { select: { name: true } } },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        prisma.tokenTopUpOrder.count({ where }),
      ])

      return apiOk({ orders, total, page, pageSize })
    },
    { bypassSubscriptionCheck: true }
  )
}

export async function POST(req: NextRequest) {
  return withTenantApi(
    req,
    'billing:update',
    async ({ ctx }) => {
      try {
        const body = await req.json()
        const data = purchaseSchema.parse(body)

        const order = await purchaseTopUp({
          organizationId: ctx.organizationId,
          packId: data.packId,
          userId: ctx.userId,
          req,
        })

        if (order.status === 'FAILED') {
          return apiError(order.failedReason ?? 'Top-up purchase failed.', 402)
        }

        return apiOk(order, 201)
      } catch (err) {
        if (err instanceof z.ZodError) return apiError(err.errors[0].message)
        if (err instanceof TopUpError) return apiError(err.message)
        throw err
      }
    },
    { bypassSubscriptionCheck: true }
  )
}
