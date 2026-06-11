import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireTenantAuth } from '@/lib/auth/require-tenant-auth'
import { TenantScopedRepository } from '@/lib/tenant-context'
import { createAuditLog } from '@/lib/audit'

const patchSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  phone: z.string().max(20).optional().nullable(),
  roleId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional().nullable(),
  avatar: z.string().url().optional().nullable(),
  aiTokenQuota: z.number().int().min(0).nullable().optional(),
})

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireTenantAuth('users:read')
  if (!auth.ok) return auth.response
  const { id } = await params
  const { organizationId } = auth.session

  const user = await prisma.user.findFirst({
    where: { id, organizationId, deletedAt: null },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      avatar: true,
      isActive: true,
      lastLoginAt: true,
      createdAt: true,
      updatedAt: true,
      organizationId: true,
      roleId: true,
      departmentId: true,
      isMfaEnabled: true,
      preferences: true,
      aiTokenQuota: true,
      aiQuotaUsed: true,
      aiQuotaResetAt: true,
      role: { select: { id: true, name: true, isSystem: true } },
      department: { select: { id: true, name: true } },
    },
  })

  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      aiEnabled: true,
      aiSettings: { select: { perUserQuotasEnabled: true, defaultUserQuota: true } },
    },
  })

  return NextResponse.json({
    success: true,
    data: {
      ...user,
      org: {
        aiEnabled: org?.aiEnabled ?? false,
        perUserQuotasEnabled: org?.aiSettings?.perUserQuotasEnabled ?? false,
        defaultUserQuota: org?.aiSettings?.defaultUserQuota ?? 10000,
      },
    },
  })
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireTenantAuth('users:update')
  if (!auth.ok) return auth.response
  const { id } = await params
  const { organizationId, userId } = auth.session

  const existing = await prisma.user.findFirst({ where: { id, organizationId, deletedAt: null } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  try {
    const body = await req.json()
    const data = patchSchema.parse(body)

    const repo = new TenantScopedRepository({ organizationId, userId })
    const updated = await repo.scoped(prisma.user).update({
      where: { id },
      data: {
        name: data.name,
        phone: data.phone,
        roleId: data.roleId,
        departmentId: data.departmentId,
        avatar: data.avatar,
        aiTokenQuota: data.aiTokenQuota,
      },
    })

    await createAuditLog({
      organizationId,
      userId,
      action: 'UPDATE',
      entity: 'User',
      entityId: id,
      oldValue: { roleId: existing.roleId, departmentId: existing.departmentId },
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
  const auth = await requireTenantAuth('users:delete')
  if (!auth.ok) return auth.response
  const { id } = await params
  const { organizationId, userId } = auth.session

  // Prevent self-deletion
  if (id === userId) {
    return NextResponse.json({ error: 'You cannot delete your own account.' }, { status: 400 })
  }

  const user = await prisma.user.findFirst({ where: { id, organizationId, deletedAt: null } })
  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const repo = new TenantScopedRepository({ organizationId, userId })
  await repo.scoped(prisma.user).delete({ where: { id } })

  await createAuditLog({
    organizationId,
    userId,
    action: 'DELETE',
    entity: 'User',
    entityId: id,
    req,
  })

  return NextResponse.json({ success: true })
}
