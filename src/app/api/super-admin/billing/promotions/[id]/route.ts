import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getSuperAdminSession } from '@/lib/auth/session'
import { requireOwner } from '@/lib/auth/permissions'
import { toJsonSafe } from '@/lib/utils'

const patchPromotionSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  description: z.string().nullable().optional(),
  discountType: z.enum(['PERCENT', 'FLAT']).nullable().optional(),
  discountValue: z.number().min(0).nullable().optional(),
  setupFeeWaiver: z.boolean().optional(),
  bonusTokens: z.number().int().min(0).optional(),
  appliesTo: z.enum(['ALL', 'ANNUAL', 'NEW_SIGNUPS']).optional(),
  startsAt: z.coerce.date().nullable().optional(),
  endsAt: z.coerce.date().nullable().optional(),
  isActive: z.boolean().optional(),
})

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSuperAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await params
    const promotion = await prisma.promotion.findUnique({ where: { id } })
    if (!promotion) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    return NextResponse.json({ success: true, data: promotion })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSuperAdminSession()
  const denied = requireOwner(session)
  if (denied || !session)
    return denied ?? NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  try {
    const body = await request.json()
    const data = patchPromotionSchema.parse(body)

    const existing = await prisma.promotion.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const promotion = await prisma.promotion.update({ where: { id }, data })

    await prisma.platformAuditLog.create({
      data: {
        superAdminId: session.superAdmin.id,
        action: 'UPDATE',
        entity: 'Promotion',
        entityId: promotion.id,
        oldValue: toJsonSafe(existing),
        newValue: data,
      },
    })

    return NextResponse.json({ success: true, data: promotion })
  } catch (err) {
    if (err instanceof z.ZodError)
      return NextResponse.json({ error: err.errors[0].message }, { status: 400 })
    console.error(err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSuperAdminSession()
  const denied = requireOwner(session)
  if (denied || !session)
    return denied ?? NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await params
    const existing = await prisma.promotion.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const promotion = await prisma.promotion.update({ where: { id }, data: { isActive: false } })

    await prisma.platformAuditLog.create({
      data: {
        superAdminId: session.superAdmin.id,
        action: 'DELETE',
        entity: 'Promotion',
        entityId: id,
        oldValue: { name: existing.name, isActive: existing.isActive },
        newValue: { isActive: false },
      },
    })

    return NextResponse.json({ success: true, data: promotion })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
