import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getSuperAdminSession } from '@/lib/auth/session'
import { requireOwner } from '@/lib/auth/permissions'
import { toJsonSafe } from '@/lib/utils'

const createPromotionSchema = z.object({
  name: z.string().min(2).max(100),
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

export async function GET(request: Request) {
  const session = await getSuperAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1') || 1)
  const pageSize = 20

  const [promotions, total] = await Promise.all([
    prisma.promotion.findMany({
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.promotion.count(),
  ])

  return NextResponse.json({ success: true, data: promotions, total, page, pageSize })
}

export async function POST(request: Request) {
  const session = await getSuperAdminSession()
  const denied = requireOwner(session)
  if (denied || !session)
    return denied ?? NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json()
    const data = createPromotionSchema.parse(body)

    const promotion = await prisma.promotion.create({ data })

    await prisma.platformAuditLog.create({
      data: {
        superAdminId: session.superAdmin.id,
        action: 'CREATE',
        entity: 'Promotion',
        entityId: promotion.id,
        newValue: toJsonSafe(promotion),
      },
    })

    return NextResponse.json({ success: true, data: promotion }, { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError)
      return NextResponse.json({ error: err.errors[0].message }, { status: 400 })
    console.error(err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
