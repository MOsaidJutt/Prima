import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withTenantApi, apiOk, apiError } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'

const createSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  parentId: z.string().uuid().optional(),
})

export async function GET(req: NextRequest) {
  return withTenantApi(req, 'products:read', async ({ ctx }) => {
    const categories = await prisma.productCategory.findMany({
      where: { organizationId: ctx.organizationId, deletedAt: null },
      orderBy: { name: 'asc' },
      include: { _count: { select: { products: { where: { deletedAt: null } } } } },
    })
    return apiOk({ categories })
  })
}

export async function POST(req: NextRequest) {
  return withTenantApi(req, 'products:create', async ({ ctx, user }) => {
    const body = await req.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) return apiError(parsed.error.issues[0].message)

    const existing = await prisma.productCategory.findFirst({
      where: { organizationId: ctx.organizationId, name: parsed.data.name, deletedAt: null },
    })
    if (existing) return apiError('Category with this name already exists')

    const category = await prisma.productCategory.create({
      data: { ...parsed.data, organizationId: ctx.organizationId, lastModifiedBy: user.id },
    })
    return apiOk(category, 201)
  })
}
