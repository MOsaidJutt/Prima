import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireTenantAuth } from '@/lib/auth/require-tenant-auth'
import { TenantScopedRepository } from '@/lib/tenant-context'
import { createAuditLog } from '@/lib/audit'

const deptSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(300).optional(),
  parentId: z.string().uuid().optional().nullable(),
  managerId: z.string().uuid().optional().nullable(),
})

export async function GET(_req: Request) {
  const auth = await requireTenantAuth('departments:read')
  if (!auth.ok) return auth.response
  const { organizationId } = auth.session

  const departments = await prisma.department.findMany({
    where: { organizationId, deletedAt: null },
    include: {
      manager: { select: { id: true, name: true, avatar: true } },
      _count: { select: { users: true, children: true } },
    },
    orderBy: { name: 'asc' },
  })

  return NextResponse.json({ success: true, data: departments })
}

export async function POST(req: Request) {
  const auth = await requireTenantAuth('departments:create')
  if (!auth.ok) return auth.response
  const { organizationId, userId } = auth.session

  try {
    const body = await req.json()
    const data = deptSchema.parse(body)

    const repo = new TenantScopedRepository({ organizationId, userId })
    const dept = await repo.scoped(prisma.department).create({
      data: {
        name: data.name,
        description: data.description,
        parentId: data.parentId ?? null,
        managerId: data.managerId ?? null,
      },
    })

    await createAuditLog({
      organizationId,
      userId,
      action: 'CREATE',
      entity: 'Department',
      entityId: (dept as { id: string }).id,
      newValue: data,
      req,
    })

    return NextResponse.json({ success: true, data: dept }, { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError)
      return NextResponse.json({ error: err.errors[0].message }, { status: 400 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
