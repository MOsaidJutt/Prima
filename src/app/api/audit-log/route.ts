import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireTenantAuth } from '@/lib/auth/require-tenant-auth'

export async function GET(req: Request) {
  const auth = await requireTenantAuth('audit_log:read')
  if (!auth.ok) return auth.response
  const { organizationId } = auth.session

  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('userId')
  const entity = searchParams.get('entity')
  const action = searchParams.get('action')
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1') || 1)
  const pageSize = 50

  const where: Record<string, unknown> = {
    organizationId,
    ...(userId ? { userId } : {}),
    ...(entity ? { entity } : {}),
    ...(action ? { action } : {}),
    ...(from || to
      ? {
          createdAt: {
            ...(from ? { gte: new Date(from) } : {}),
            ...(to ? { lte: new Date(to) } : {}),
          },
        }
      : {}),
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: { user: { select: { id: true, name: true, email: true, avatar: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.auditLog.count({ where }),
  ])

  return NextResponse.json({
    success: true,
    data: logs,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  })
}
