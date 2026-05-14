import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withTenantApi, apiOk, apiError } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'
import { createAuditLog } from '@/lib/audit'

const createSchema = z.object({
  name: z.string().min(1),
  address: z.string().optional(),
  city: z.string().optional(),
  isDefault: z.boolean().default(false),
})

export async function GET(req: NextRequest) {
  return withTenantApi(req, 'inventory:read', async ({ ctx }) => {
    const warehouses = await prisma.warehouse.findMany({
      where: { organizationId: ctx.organizationId, deletedAt: null },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
      include: {
        _count: { select: { inventoryStock: true } },
      },
    })
    return apiOk({ warehouses })
  })
}

export async function POST(req: NextRequest) {
  return withTenantApi(req, 'inventory:adjust', async ({ ctx, user }) => {
    const body = await req.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) return apiError(parsed.error.issues[0].message)

    const count = await prisma.warehouse.count({ where: { organizationId: ctx.organizationId } })
    const code = `WH-${String(count + 1).padStart(3, '0')}`

    // If this is the first warehouse, make it default
    const isDefault = parsed.data.isDefault || count === 0

    // If setting as default, unset others
    if (isDefault) {
      await prisma.warehouse.updateMany({
        where: { organizationId: ctx.organizationId, deletedAt: null },
        data: { isDefault: false },
      })
    }

    const warehouse = await prisma.warehouse.create({
      data: {
        ...parsed.data,
        code,
        organizationId: ctx.organizationId,
        isDefault,
        lastModifiedBy: user.id,
      },
    })

    await createAuditLog({
      organizationId: ctx.organizationId,
      userId: user.id,
      action: 'CREATE',
      entity: 'Warehouse',
      entityId: warehouse.id,
      newValue: warehouse,
    })
    return apiOk(warehouse, 201)
  })
}
