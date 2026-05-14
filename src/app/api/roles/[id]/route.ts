import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireTenantAuth } from '@/lib/auth/require-tenant-auth'
import { TenantScopedRepository } from '@/lib/tenant-context'
import { isValidSlug } from '@/lib/permissions'
import { createAuditLog } from '@/lib/audit'

const patchSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  description: z.string().max(200).optional(),
  permissions: z.array(z.string()).optional(),
})

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireTenantAuth('roles:read')
  if (!auth.ok) return auth.response
  const { id } = await params
  const { organizationId } = auth.session

  const role = await prisma.role.findFirst({
    where: { id, organizationId, deletedAt: null },
    include: { _count: { select: { users: true } } },
  })

  if (!role) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ success: true, data: role })
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireTenantAuth('roles:update')
  if (!auth.ok) return auth.response
  const { id } = await params
  const { organizationId, userId } = auth.session

  const role = await prisma.role.findFirst({ where: { id, organizationId, deletedAt: null } })
  if (!role) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (role.isSystem)
    return NextResponse.json({ error: 'System roles cannot be modified.' }, { status: 403 })

  try {
    const body = await req.json()
    const data = patchSchema.parse(body)

    if (data.permissions) {
      const invalidSlugs = data.permissions.filter((s) => !isValidSlug(s))
      if (invalidSlugs.length > 0) {
        return NextResponse.json(
          { error: `Invalid slugs: ${invalidSlugs.join(', ')}` },
          { status: 400 }
        )
      }
      if (data.permissions.includes('*')) {
        return NextResponse.json(
          { error: 'Wildcard permission is reserved for system roles.' },
          { status: 400 }
        )
      }
    }

    const repo = new TenantScopedRepository({ organizationId, userId })
    const updated = await repo.scoped(prisma.role).update({
      where: { id },
      data: { ...data },
    })

    await createAuditLog({
      organizationId,
      userId,
      action: 'UPDATE',
      entity: 'Role',
      entityId: id,
      oldValue: role,
      newValue: data,
      req,
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (err) {
    if (err instanceof z.ZodError)
      return NextResponse.json({ error: err.errors[0].message }, { status: 400 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireTenantAuth('roles:delete')
  if (!auth.ok) return auth.response
  const { id } = await params
  const { organizationId, userId } = auth.session

  const role = await prisma.role.findFirst({
    where: { id, organizationId, deletedAt: null },
    include: { _count: { select: { users: true } } },
  })

  if (!role) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (role.isSystem)
    return NextResponse.json({ error: 'System roles cannot be deleted.' }, { status: 403 })
  if (role._count.users > 0) {
    return NextResponse.json(
      { error: 'Cannot delete a role that has users assigned. Reassign users first.' },
      { status: 409 }
    )
  }

  const repo = new TenantScopedRepository({ organizationId, userId })
  await repo.scoped(prisma.role).delete({ where: { id } })

  await createAuditLog({
    organizationId,
    userId,
    action: 'DELETE',
    entity: 'Role',
    entityId: id,
    req,
  })

  return NextResponse.json({ success: true })
}
