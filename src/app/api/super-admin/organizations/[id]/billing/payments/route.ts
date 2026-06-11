import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getSuperAdminSession } from '@/lib/auth/session'
import { requireOwner } from '@/lib/auth/permissions'
import { reconcilePlatformPayment } from '@/lib/billing/subscription'
import { toJsonSafe } from '@/lib/utils'

const createPaymentSchema = z
  .object({
    type: z.enum(['SUBSCRIPTION', 'SETUP_FEE', 'TOPUP', 'MANUAL_ADJUSTMENT']),
    amount: z.number(),
    provider: z.enum(['MANUAL', 'STRIPE', 'JAZZCASH', 'EASYPAISA']).default('MANUAL'),
    providerRef: z.string().optional(),
    notes: z.string().optional(),
    topUpOrderId: z.string().uuid().optional(),
    markSucceeded: z.boolean().default(false),
  })
  .refine((data) => (data.type === 'MANUAL_ADJUSTMENT' ? data.amount !== 0 : data.amount > 0), {
    message:
      'Amount must be positive for this payment type. Negative amounts are only allowed for MANUAL_ADJUSTMENT (credits).',
    path: ['amount'],
  })

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSuperAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { searchParams } = new URL(request.url)
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1') || 1)
  const pageSize = 20

  const where = { organizationId: id }
  const [payments, total] = await Promise.all([
    prisma.platformPayment.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.platformPayment.count({ where }),
  ])

  return NextResponse.json({ success: true, data: payments, total, page, pageSize })
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSuperAdminSession()
  const denied = requireOwner(session)
  if (denied || !session)
    return denied ?? NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const org = await prisma.organization.findFirst({ where: { id, deletedAt: null } })
  if (!org) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  try {
    const body = await request.json()
    const data = createPaymentSchema.parse(body)

    const payment = await prisma.platformPayment.create({
      data: {
        organizationId: id,
        type: data.type,
        amount: data.amount,
        provider: data.provider,
        providerRef: data.providerRef,
        notes: data.notes,
        topUpOrderId: data.topUpOrderId,
        recordedBy: session.superAdmin.id,
        status: 'PENDING',
      },
    })

    const final = data.markSucceeded
      ? await reconcilePlatformPayment(payment.id, 'SUCCEEDED', data.notes)
      : payment

    await prisma.platformAuditLog.create({
      data: {
        superAdminId: session.superAdmin.id,
        action: 'CREATE',
        entity: 'PlatformPayment',
        entityId: payment.id,
        newValue: toJsonSafe(final),
      },
    })

    return NextResponse.json({ success: true, data: final }, { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError)
      return NextResponse.json({ error: err.errors[0].message }, { status: 400 })
    console.error(err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
