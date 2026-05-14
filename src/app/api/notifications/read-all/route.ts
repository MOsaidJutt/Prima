import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireTenantAuth } from '@/lib/auth/require-tenant-auth'

export async function POST(_req: Request) {
  try {
    const auth = await requireTenantAuth()
    if (!auth.ok) return auth.response
    const { userId, organizationId } = auth.session

    await prisma.notification.updateMany({
      where: { userId, organizationId, isRead: false, deletedAt: null },
      data: { isRead: true, readAt: new Date() },
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[notifications/read-all POST]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
