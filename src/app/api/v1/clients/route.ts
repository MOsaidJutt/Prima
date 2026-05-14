import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withTenantApi, apiOk, apiError, generateEntityCode } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'
import { createAuditLog } from '@/lib/audit'

const createSchema = z.object({
  companyName: z.string().min(1),
  contactName: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  phone2: z.string().optional(),
  website: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().default('PK'),
  postalCode: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  ntn: z.string().optional(),
  strn: z.string().optional(),
  distributorId: z.string().uuid().optional(),
  assignedRepId: z.string().uuid().optional(),
  businessType: z
    .enum(['RETAIL', 'WHOLESALE', 'DISTRIBUTOR', 'MANUFACTURER', 'SERVICE', 'OTHER'])
    .optional(),
  businessSize: z.enum(['SMALL', 'MEDIUM', 'LARGE', 'ENTERPRISE']).optional(),
  industry: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'PROSPECT', 'CHURNED']).default('ACTIVE'),
  creditLimit: z.number().min(0).default(0),
  paymentTerms: z.number().min(0).default(30),
  tags: z.array(z.string()).default([]),
  notes: z.string().optional(),
})

export async function GET(req: NextRequest) {
  return withTenantApi(req, 'clients:read', async ({ ctx }) => {
    const url = new URL(req.url)
    const page = Math.max(1, Number(url.searchParams.get('page') ?? 1))
    const pageSize = Math.min(100, Number(url.searchParams.get('pageSize') ?? 25))
    const search = url.searchParams.get('search') ?? ''
    const city = url.searchParams.get('city') ?? ''
    const status = url.searchParams.get('status') ?? ''
    const distributorId = url.searchParams.get('distributorId') ?? ''

    const where = {
      organizationId: ctx.organizationId,
      deletedAt: null,
      ...(search && {
        OR: [
          { companyName: { contains: search, mode: 'insensitive' as const } },
          { code: { contains: search, mode: 'insensitive' as const } },
          { contactName: { contains: search, mode: 'insensitive' as const } },
          { email: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
      ...(city && { city: { contains: city, mode: 'insensitive' as const } }),
      ...(status && { status: status as 'ACTIVE' | 'INACTIVE' | 'PROSPECT' | 'CHURNED' }),
      ...(distributorId && { distributorId }),
    }

    const [clients, total] = await Promise.all([
      prisma.client.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          code: true,
          companyName: true,
          contactName: true,
          email: true,
          phone: true,
          city: true,
          status: true,
          businessType: true,
          businessSize: true,
          currentBalance: true,
          totalLifetimeValue: true,
          totalOrders: true,
          lastOrderDate: true,
          paymentBehaviorScore: true,
          paymentBehaviorLabel: true,
          createdAt: true,
          distributor: { select: { id: true, code: true, companyName: true } },
          assignedRep: { select: { id: true, name: true } },
        },
      }),
      prisma.client.count({ where }),
    ])

    return apiOk({ clients, total, page, pageSize })
  })
}

export async function POST(req: NextRequest) {
  return withTenantApi(req, 'clients:create', async ({ ctx, user }) => {
    const body = await req.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) return apiError(parsed.error.issues[0].message)

    const code = await generateEntityCode(ctx.organizationId, 'CLT', 'client')
    const client = await prisma.client.create({
      data: { ...parsed.data, code, organizationId: ctx.organizationId, lastModifiedBy: user.id },
    })

    await createAuditLog({
      organizationId: ctx.organizationId,
      userId: user.id,
      action: 'CREATE',
      entity: 'Client',
      entityId: client.id,
      newValue: client,
      req,
    })
    return apiOk(client, 201)
  })
}
