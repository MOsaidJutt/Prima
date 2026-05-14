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
  bankName: z.string().optional(),
  bankAccount: z.string().optional(),
  bankBranch: z.string().optional(),
  iban: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'BLACKLISTED']).default('ACTIVE'),
  tier: z.enum(['GOLD', 'SILVER', 'BRONZE']).default('BRONZE'),
  creditLimit: z.number().min(0).default(0),
  paymentTerms: z.number().min(0).default(30),
  tags: z.array(z.string()).default([]),
  notes: z.string().optional(),
})

export async function GET(req: NextRequest) {
  return withTenantApi(req, 'distributors:read', async ({ ctx }) => {
    const url = new URL(req.url)
    const page = Math.max(1, Number(url.searchParams.get('page') ?? 1))
    const pageSize = Math.min(100, Number(url.searchParams.get('pageSize') ?? 25))
    const search = url.searchParams.get('search') ?? ''
    const city = url.searchParams.get('city') ?? ''
    const status = url.searchParams.get('status') ?? ''
    const tier = url.searchParams.get('tier') ?? ''

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
      ...(status && { status: status as 'ACTIVE' | 'INACTIVE' | 'BLACKLISTED' }),
      ...(tier && { tier: tier as 'GOLD' | 'SILVER' | 'BRONZE' }),
    }

    const [distributors, total] = await Promise.all([
      prisma.distributor.findMany({
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
          tier: true,
          currentBalance: true,
          rating: true,
          creditLimit: true,
          createdAt: true,
          updatedAt: true,
          _count: { select: { clients: { where: { deletedAt: null } } } },
        },
      }),
      prisma.distributor.count({ where }),
    ])

    return apiOk({ distributors, total, page, pageSize })
  })
}

export async function POST(req: NextRequest) {
  return withTenantApi(req, 'distributors:create', async ({ ctx, user }) => {
    const body = await req.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) return apiError(parsed.error.issues[0].message)

    const code = await generateEntityCode(ctx.organizationId, 'DST', 'distributor')
    const distributor = await prisma.distributor.create({
      data: {
        ...parsed.data,
        code,
        organizationId: ctx.organizationId,
        creditLimit: parsed.data.creditLimit,
        lastModifiedBy: user.id,
      },
    })

    await createAuditLog({
      organizationId: ctx.organizationId,
      userId: user.id,
      action: 'CREATE',
      entity: 'Distributor',
      entityId: distributor.id,
      newValue: distributor,
      req,
    })

    return apiOk(distributor, 201)
  })
}
