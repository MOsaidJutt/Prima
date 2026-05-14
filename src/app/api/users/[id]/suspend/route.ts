import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireTenantAuth } from '@/lib/auth/require-tenant-auth'
import { TenantScopedRepository } from '@/lib/tenant-context'
import { createAuditLog } from '@/lib/audit'
import { createNotification } from '@/lib/notifications'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireTenantAuth('users:suspend')
    if (!auth.ok) return auth.response
    const { id } = await params
    const { organizationId, userId } = auth.session

    if (id === userId) {
      return NextResponse.json({ error: 'You cannot suspend your own account.' }, { status: 400 })
    }

    const user = await prisma.user.findFirst({ where: { id, organizationId, deletedAt: null } })
    if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const newStatus = !user.isActive
    const repo = new TenantScopedRepository({ organizationId, userId })
    await repo.scoped(prisma.user).update({ where: { id }, data: { isActive: newStatus } })

    await createAuditLog({
      organizationId,
      userId,
      action: newStatus ? 'UNSUSPEND' : 'SUSPEND',
      entity: 'User',
      entityId: id,
      oldValue: { isActive: user.isActive },
      newValue: { isActive: newStatus },
      req,
    })

    if (!newStatus) {
      await createNotification({
        organizationId,
        userId: id,
        type: 'system',
        title: 'Account suspended',
        body: 'Your account has been suspended. Contact your admin.',
      })
    }

    return NextResponse.json({ success: true, isActive: newStatus })
  } catch (err) {
    console.error('[users/[id]/suspend POST]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
