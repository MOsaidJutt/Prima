import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireTenantAuth } from '@/lib/auth/require-tenant-auth'
import { createAuditLog } from '@/lib/audit'

export async function GET(req: Request) {
  const auth = await requireTenantAuth('users:read')
  if (!auth.ok) return auth.response
  const { organizationId } = auth.session

  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')
  const roleId = searchParams.get('roleId')
  const departmentId = searchParams.get('departmentId')
  const status = searchParams.get('status') // 'active' | 'suspended'
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1') || 1)
  const pageSize = 20

  const where: Record<string, unknown> = {
    organizationId,
    deletedAt: null,
    ...(roleId ? { roleId } : {}),
    ...(departmentId ? { departmentId } : {}),
    ...(status === 'active'
      ? { isActive: true }
      : status === 'suspended'
        ? { isActive: false }
        : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { email: { contains: q, mode: 'insensitive' } },
          ],
        }
      : {}),
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      include: {
        role: { select: { id: true, name: true, isSystem: true } },
        department: { select: { id: true, name: true } },
      },
      orderBy: { name: 'asc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.user.count({ where }),
  ])

  return NextResponse.json({
    success: true,
    data: users,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  })
}

const bulkSchema = z.object({
  action: z.enum(['deactivate', 'activate', 'change_role']),
  ids: z.array(z.string().uuid()).min(1),
  roleId: z.string().uuid().optional(),
})

export async function PATCH(req: Request) {
  const auth = await requireTenantAuth('users:update')
  if (!auth.ok) return auth.response
  const { organizationId, userId } = auth.session

  try {
    const body = await req.json()
    const data = bulkSchema.parse(body)

    let updateData: Record<string, unknown> = {}
    if (data.action === 'deactivate') updateData = { isActive: false }
    else if (data.action === 'activate') updateData = { isActive: true }
    else if (data.action === 'change_role' && data.roleId) updateData = { roleId: data.roleId }

    await prisma.user.updateMany({
      where: { id: { in: data.ids }, organizationId, deletedAt: null },
      data: { ...updateData, lastModifiedBy: userId },
    })

    await createAuditLog({
      organizationId,
      userId,
      action: 'UPDATE',
      entity: 'User',
      newValue: { bulkAction: data.action, affectedIds: data.ids },
      req,
    })

    return NextResponse.json({ success: true, affected: data.ids.length })
  } catch (err) {
    if (err instanceof z.ZodError)
      return NextResponse.json({ error: err.errors[0].message }, { status: 400 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
