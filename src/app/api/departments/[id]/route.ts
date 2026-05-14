import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireTenantAuth } from '@/lib/auth/require-tenant-auth'
import { TenantScopedRepository } from '@/lib/tenant-context'
import { createAuditLog } from '@/lib/audit'

const patchSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(300).optional().nullable(),
  parentId: z.string().uuid().optional().nullable(),
  managerId: z.string().uuid().optional().nullable(),
})

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireTenantAuth('departments:read')
    if (!auth.ok) return auth.response
    const { id } = await params
    const { organizationId } = auth.session

    const dept = await prisma.department.findFirst({
      where: { id, organizationId, deletedAt: null },
      include: {
        manager: { select: { id: true, name: true, avatar: true } },
        parent: { select: { id: true, name: true } },
        children: { where: { deletedAt: null }, select: { id: true, name: true } },
        _count: { select: { users: true } },
      },
    })

    if (!dept) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ success: true, data: dept })
  } catch (err) {
    console.error('[departments/[id] GET]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireTenantAuth('departments:update')
    if (!auth.ok) return auth.response
    const { id } = await params
    const { organizationId, userId } = auth.session

    const existing = await prisma.department.findFirst({
      where: { id, organizationId, deletedAt: null },
    })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const body = await req.json()
    const data = patchSchema.parse(body)

    // Verify managerId belongs to this org — prevents cross-org data reference
    if (data.managerId) {
      const mgr = await prisma.user.findFirst({
        where: { id: data.managerId, organizationId, deletedAt: null, isActive: true },
      })
      if (!mgr) return NextResponse.json({ error: 'Manager user not found' }, { status: 404 })
    }

    // Verify parentId belongs to this org — also block self-reference
    if (data.parentId) {
      if (data.parentId === id) {
        return NextResponse.json(
          { error: 'A department cannot be its own parent' },
          { status: 400 }
        )
      }
      const parent = await prisma.department.findFirst({
        where: { id: data.parentId, organizationId, deletedAt: null },
      })
      if (!parent) {
        return NextResponse.json({ error: 'Parent department not found' }, { status: 404 })
      }
    }

    const repo = new TenantScopedRepository({ organizationId, userId })
    const updated = await repo.scoped(prisma.department).update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        parentId: data.parentId,
        managerId: data.managerId,
      },
    })

    await createAuditLog({
      organizationId,
      userId,
      action: 'UPDATE',
      entity: 'Department',
      entityId: id,
      oldValue: existing,
      newValue: data,
      req,
    })
    return NextResponse.json({ success: true, data: updated })
  } catch (err) {
    if (err instanceof z.ZodError)
      return NextResponse.json({ error: err.errors[0].message }, { status: 400 })
    console.error('[departments/[id] PATCH]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireTenantAuth('departments:delete')
    if (!auth.ok) return auth.response
    const { id } = await params
    const { organizationId, userId } = auth.session

    const dept = await prisma.department.findFirst({
      where: { id, organizationId, deletedAt: null },
      include: { _count: { select: { users: true, children: true } } },
    })

    if (!dept) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (dept._count.users > 0) {
      return NextResponse.json(
        { error: 'Reassign or remove all users before deleting this department.' },
        { status: 409 }
      )
    }

    const repo = new TenantScopedRepository({ organizationId, userId })
    await repo.scoped(prisma.department).delete({ where: { id } })

    await createAuditLog({
      organizationId,
      userId,
      action: 'DELETE',
      entity: 'Department',
      entityId: id,
      req,
    })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[departments/[id] DELETE]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
