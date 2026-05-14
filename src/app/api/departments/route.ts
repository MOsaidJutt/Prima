import { NextResponse } from 'next/server'
import { z, ZodError } from 'zod'
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
  try {
    const auth = await requireTenantAuth('departments:read')
    if (!auth.ok) return auth.response
    const { organizationId } = auth.session

    const [departments, total] = await Promise.all([
      prisma.department.findMany({
        where: { organizationId, deletedAt: null },
        include: {
          manager: { select: { id: true, name: true, avatar: true } },
          _count: { select: { users: true, children: true } },
        },
        orderBy: { name: 'asc' },
        take: 200,
      }),
      prisma.department.count({ where: { organizationId, deletedAt: null } }),
    ])

    return NextResponse.json({ success: true, data: departments, total })
  } catch (err) {
    console.error('[departments GET]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireTenantAuth('departments:create')
    if (!auth.ok) return auth.response
    const { organizationId, userId } = auth.session

    const body = await req.json()
    const data = deptSchema.parse(body)

    // Verify managerId belongs to this org
    if (data.managerId) {
      const mgr = await prisma.user.findFirst({
        where: { id: data.managerId, organizationId, deletedAt: null, isActive: true },
      })
      if (!mgr) return NextResponse.json({ error: 'Manager user not found' }, { status: 404 })
    }

    // Verify parentId belongs to this org
    if (data.parentId) {
      const parent = await prisma.department.findFirst({
        where: { id: data.parentId, organizationId, deletedAt: null },
      })
      if (!parent)
        return NextResponse.json({ error: 'Parent department not found' }, { status: 404 })
    }

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
    if (err instanceof ZodError) {
      return NextResponse.json({ error: err.errors[0].message }, { status: 400 })
    }
    console.error('[departments POST]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
