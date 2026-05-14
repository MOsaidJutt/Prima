import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireTenantAuth } from '@/lib/auth/require-tenant-auth'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireTenantAuth()
  if (!auth.ok) return auth.response
  const { id } = await params
  const { userId, organizationId } = auth.session

  await prisma.notification.updateMany({
    where: { id, userId, organizationId, deletedAt: null },
    data: { isRead: true, readAt: new Date() },
  })

  return NextResponse.json({ success: true })
}
