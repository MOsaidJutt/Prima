import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireTenantAuth } from '@/lib/auth/require-tenant-auth'
import { TenantScopedRepository } from '@/lib/tenant-context'
import { isValidSlug } from '@/lib/permissions'
import { createAuditLog } from '@/lib/audit'

const roleSchema = z.object({
  name: z.string().min(1).max(50),
  description: z.string().max(200).optional(),
  permissions: z.array(z.string()),
})

export async function GET(_req: Request) {
  try {
    const auth = await requireTenantAuth('roles:read')
    if (!auth.ok) return auth.response

    const { organizationId } = auth.session

    const [roles, total] = await Promise.all([
      prisma.role.findMany({
        where: { organizationId, deletedAt: null },
        include: { _count: { select: { users: true } } },
        orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
        take: 200,
      }),
      prisma.role.count({ where: { organizationId, deletedAt: null } }),
    ])

    return NextResponse.json({ success: true, data: roles, total })
  } catch (err) {
    console.error('[roles GET]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const auth = await requireTenantAuth('roles:create')
  if (!auth.ok) return auth.response

  const { organizationId, userId } = auth.session

  try {
    const body = await req.json()
    const data = roleSchema.parse(body)

    // Validate all permission slugs
    const invalidSlugs = data.permissions.filter((s) => !isValidSlug(s))
    if (invalidSlugs.length > 0) {
      return NextResponse.json(
        { error: `Invalid permission slugs: ${invalidSlugs.join(', ')}` },
        { status: 400 }
      )
    }

    // Disallow wildcard '*' in custom roles
    if (data.permissions.includes('*')) {
      return NextResponse.json(
        { error: 'Wildcard permission is reserved for system roles.' },
        { status: 400 }
      )
    }

    const repo = new TenantScopedRepository({ organizationId, userId })
    const role = await repo.scoped(prisma.role).create({
      data: {
        name: data.name,
        description: data.description,
        permissions: data.permissions,
        isSystem: false,
      },
    })

    await createAuditLog({
      organizationId,
      userId,
      action: 'CREATE',
      entity: 'Role',
      entityId: (role as { id: string }).id,
      newValue: data,
      req,
    })

    return NextResponse.json({ success: true, data: role }, { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError)
      return NextResponse.json({ error: err.errors[0].message }, { status: 400 })
    console.error('[roles POST]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
