import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireTenantAuth } from '@/lib/auth/require-tenant-auth'

export async function GET(req: Request) {
  const auth = await requireTenantAuth()
  if (!auth.ok) return auth.response
  const { userId, organizationId } = auth.session

  const { searchParams } = new URL(req.url)
  const limit = Math.min(50, parseInt(searchParams.get('limit') ?? '20') || 20)
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1') || 1)
  const unreadOnly = searchParams.get('unread') === 'true'

  const where = {
    userId,
    organizationId,
    deletedAt: null,
    ...(unreadOnly ? { isRead: false } : {}),
  }

  const [notifications, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({
      where: { userId, organizationId, deletedAt: null, isRead: false },
    }),
  ])

  return NextResponse.json({
    success: true,
    data: notifications,
    total,
    unreadCount,
    page,
    pageSize: limit,
  })
}
