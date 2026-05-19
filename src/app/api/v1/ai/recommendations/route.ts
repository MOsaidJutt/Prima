import { NextRequest } from 'next/server'
import { withTenantApi, apiOk } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  return withTenantApi(req, null, async ({ ctx }) => {
    const { searchParams } = new URL(req.url)
    const type = searchParams.get('type')
    const severity = searchParams.get('severity')
    const status = searchParams.get('status') ?? 'ACTIVE'
    const page = parseInt(searchParams.get('page') ?? '1')
    const limit = parseInt(searchParams.get('limit') ?? '20')

    const where = {
      organizationId: ctx.organizationId,
      status: status as 'ACTIVE' | 'ACKNOWLEDGED' | 'DISMISSED' | 'ACTED_ON',
      ...(type ? { type: type as never } : {}),
      ...(severity ? { severity: severity as never } : {}),
    }

    const [recommendations, total] = await Promise.all([
      prisma.aIRecommendation.findMany({
        where,
        orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.aIRecommendation.count({ where }),
    ])

    return apiOk({ recommendations, total, page, totalPages: Math.ceil(total / limit) })
  })
}
