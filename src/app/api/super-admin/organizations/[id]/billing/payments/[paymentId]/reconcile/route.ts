import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getSuperAdminSession } from '@/lib/auth/session'
import { requireOwner } from '@/lib/auth/permissions'
import { reconcilePlatformPayment } from '@/lib/billing/subscription'
import { toJsonSafe } from '@/lib/utils'

const reconcileSchema = z.object({
  status: z.enum(['SUCCEEDED', 'FAILED', 'REFUNDED']),
  notes: z.string().optional(),
})

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; paymentId: string }> }
) {
  const session = await getSuperAdminSession()
  const denied = requireOwner(session)
  if (denied || !session)
    return denied ?? NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, paymentId } = await params

  const existing = await prisma.platformPayment.findFirst({
    where: { id: paymentId, organizationId: id },
  })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  try {
    const body = await request.json()
    const data = reconcileSchema.parse(body)

    const updated = await reconcilePlatformPayment(paymentId, data.status, data.notes)

    await prisma.platformAuditLog.create({
      data: {
        superAdminId: session.superAdmin.id,
        action: 'UPDATE',
        entity: 'PlatformPayment',
        entityId: paymentId,
        oldValue: toJsonSafe(existing),
        newValue: toJsonSafe(updated),
      },
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (err) {
    if (err instanceof z.ZodError)
      return NextResponse.json({ error: err.errors[0].message }, { status: 400 })
    console.error(err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
