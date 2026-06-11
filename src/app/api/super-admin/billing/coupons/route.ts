import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getSuperAdminSession } from '@/lib/auth/session'
import { requireOwner } from '@/lib/auth/permissions'

const createCouponSchema = z.object({
  code: z
    .string()
    .min(3)
    .max(40)
    .regex(/^[A-Za-z0-9_-]+$/)
    .transform((v) => v.toUpperCase()),
  description: z.string().nullable().optional(),
  discountType: z.enum(['PERCENT', 'FLAT']).nullable().optional(),
  discountValue: z.number().min(0).nullable().optional(),
  setupFeeWaiver: z.boolean().optional(),
  bonusTokens: z.number().int().min(0).optional(),
  applicablePlans: z.array(z.enum(['STARTER', 'PRO', 'BUSINESS', 'ENTERPRISE'])).optional(),
  maxRedemptions: z.number().int().positive().nullable().optional(),
  validFrom: z.coerce.date().optional(),
  validUntil: z.coerce.date().nullable().optional(),
  isActive: z.boolean().optional(),
})

export async function GET(request: Request) {
  const session = await getSuperAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1') || 1)
  const pageSize = 20

  const where = q
    ? { code: { contains: q.toUpperCase(), mode: 'insensitive' as const } }
    : undefined

  const [coupons, total] = await Promise.all([
    prisma.coupon.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.coupon.count({ where }),
  ])

  return NextResponse.json({ success: true, data: coupons, total, page, pageSize })
}

export async function POST(request: Request) {
  const session = await getSuperAdminSession()
  const denied = requireOwner(session)
  if (denied || !session)
    return denied ?? NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json()
    const data = createCouponSchema.parse(body)

    const existing = await prisma.coupon.findUnique({ where: { code: data.code } })
    if (existing) return NextResponse.json({ error: 'Coupon code already exists' }, { status: 400 })

    const coupon = await prisma.coupon.create({ data })

    await prisma.platformAuditLog.create({
      data: {
        superAdminId: session.superAdmin.id,
        action: 'CREATE',
        entity: 'Coupon',
        entityId: coupon.id,
        newValue: {
          code: coupon.code,
          discountType: coupon.discountType,
          discountValue: coupon.discountValue?.toString(),
        },
      },
    })

    return NextResponse.json({ success: true, data: coupon }, { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError)
      return NextResponse.json({ error: err.errors[0].message }, { status: 400 })
    console.error(err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
