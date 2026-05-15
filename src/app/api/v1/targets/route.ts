import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withTenantApi, apiOk, apiError } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'
import { createAuditLog } from '@/lib/audit'

const createSchema = z.object({
  name: z.string().min(1),
  scope: z.enum(['ORGANIZATION', 'DEPARTMENT', 'USER', 'PRODUCT', 'CLIENT']),
  type: z.enum(['REVENUE', 'UNITS', 'VISITS', 'NEW_CLIENTS', 'COLLECTIONS']),
  period: z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY', 'CUSTOM']),
  userId: z.string().uuid().optional().nullable(),
  departmentId: z.string().uuid().optional().nullable(),
  productId: z.string().uuid().optional().nullable(),
  clientId: z.string().uuid().optional().nullable(),
  targetValue: z.number().positive(),
  periodStart: z.string().datetime(),
  periodEnd: z.string().datetime(),
  customPeriodLabel: z.string().optional(),
})

export async function GET(req: NextRequest) {
  return withTenantApi(req, 'targets:read', async ({ ctx }) => {
    const url = new URL(req.url)
    const page = Math.max(1, Number(url.searchParams.get('page') ?? 1))
    const pageSize = Math.min(100, Number(url.searchParams.get('pageSize') ?? 50))
    const scope = url.searchParams.get('scope') ?? ''
    const userId = url.searchParams.get('userId') ?? ''
    const active = url.searchParams.get('active')

    const where = {
      organizationId: ctx.organizationId,
      deletedAt: null,
      ...(scope
        ? { scope: scope as 'ORGANIZATION' | 'DEPARTMENT' | 'USER' | 'PRODUCT' | 'CLIENT' }
        : {}),
      ...(userId ? { userId } : {}),
      ...(active === 'true' ? { isActive: true } : {}),
    }

    const [targets, total] = await Promise.all([
      prisma.salesTarget.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          user: { select: { id: true, name: true } },
          department: { select: { id: true, name: true } },
          product: { select: { id: true, name: true, sku: true } },
          client: { select: { id: true, companyName: true, code: true } },
        },
      }),
      prisma.salesTarget.count({ where }),
    ])

    return apiOk({ data: targets, total, page, pageSize })
  })
}

export async function POST(req: NextRequest) {
  return withTenantApi(req, 'targets:create', async ({ ctx, user }) => {
    const body = await req.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) return apiError(parsed.error.issues[0]?.message ?? 'Validation error')
    const d = parsed.data

    const target = await prisma.salesTarget.create({
      data: {
        organizationId: ctx.organizationId,
        name: d.name,
        scope: d.scope,
        type: d.type,
        period: d.period,
        userId: d.userId ?? null,
        departmentId: d.departmentId ?? null,
        productId: d.productId ?? null,
        clientId: d.clientId ?? null,
        targetValue: d.targetValue,
        achievedValue: 0,
        periodStart: new Date(d.periodStart),
        periodEnd: new Date(d.periodEnd),
        customPeriodLabel: d.customPeriodLabel ?? null,
        lastModifiedBy: user.id,
      },
    })

    await createAuditLog({
      organizationId: ctx.organizationId,
      userId: user.id,
      action: 'CREATE',
      entity: 'SalesTarget',
      entityId: target.id,
      req,
    })
    return apiOk(target, 201)
  })
}
