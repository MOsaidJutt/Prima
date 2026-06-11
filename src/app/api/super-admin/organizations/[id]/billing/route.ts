import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getSuperAdminSession } from '@/lib/auth/session'
import { requireOwner } from '@/lib/auth/permissions'
import {
  changePlan,
  markPastDue,
  markSuspended,
  cancelSubscription,
  SubscriptionError,
} from '@/lib/billing/subscription'
import { toJsonSafe } from '@/lib/utils'

const ORG_BILLING_SELECT = {
  id: true,
  name: true,
  slug: true,
  status: true,
  plan: true,
  billingCycle: true,
  monthlyPrice: true,
  customPricing: true,
  setupFeePaid: true,
  trialEndsAt: true,
  subscriptionStart: true,
  subscriptionEnd: true,
  nextBillingDate: true,
  pastDueAt: true,
  suspendedAt: true,
  cancelledAt: true,
  gracePeriodEndsAt: true,
  lastReminderSentAt: true,
  stripeCustomerId: true,
  aiEnabled: true,
  monthlyTokenBudget: true,
  monthlyTokensUsed: true,
  autoTopUpEnabled: true,
  autoTopUpThreshold: true,
  autoTopUpPackId: true,
  billingEmail: true,
  billingName: true,
  billingPhone: true,
} as const

const patchSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('change_plan'),
    newTier: z.enum(['STARTER', 'PRO', 'BUSINESS', 'ENTERPRISE']),
    billingCycle: z.enum(['MONTHLY', 'ANNUAL']).optional(),
  }),
  z.object({
    action: z.literal('set_custom_price'),
    monthlyPrice: z.number().min(0),
  }),
  z.object({ action: z.literal('clear_custom_price') }),
  z.object({ action: z.literal('mark_past_due') }),
  z.object({ action: z.literal('suspend') }),
  z.object({ action: z.literal('cancel') }),
  z.object({ action: z.literal('reactivate') }),
])

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSuperAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const org = await prisma.organization.findFirst({
    where: { id, deletedAt: null },
    select: ORG_BILLING_SELECT,
  })
  if (!org) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const [billingPlan, wallet, paymentMethods, recentPayments, invoices, topUpOrders] =
    await Promise.all([
      prisma.billingPlan.findUnique({ where: { tier: org.plan } }),
      prisma.tokenWallet.findUnique({ where: { organizationId: id } }),
      prisma.billingPaymentMethod.findMany({
        where: { organizationId: id },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
      }),
      prisma.platformPayment.findMany({
        where: { organizationId: id },
        orderBy: { createdAt: 'desc' },
        take: 25,
      }),
      prisma.organizationInvoice.findMany({
        where: { organizationId: id, deletedAt: null },
        orderBy: { issueDate: 'desc' },
        take: 12,
      }),
      prisma.tokenTopUpOrder.findMany({
        where: { organizationId: id },
        orderBy: { createdAt: 'desc' },
        take: 25,
        include: { pack: { select: { name: true } } },
      }),
    ])

  return NextResponse.json({
    success: true,
    data: { org, billingPlan, wallet, paymentMethods, recentPayments, invoices, topUpOrders },
  })
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSuperAdminSession()
  const denied = requireOwner(session)
  if (denied || !session)
    return denied ?? NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const existing = await prisma.organization.findFirst({
    where: { id, deletedAt: null },
    select: ORG_BILLING_SELECT,
  })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  try {
    const body = await request.json()
    const data = patchSchema.parse(body)

    let result: unknown = null

    switch (data.action) {
      case 'change_plan': {
        result = await changePlan(id, { newTier: data.newTier, billingCycle: data.billingCycle })
        break
      }
      case 'set_custom_price': {
        await prisma.organization.update({
          where: { id },
          data: { monthlyPrice: data.monthlyPrice, customPricing: true },
        })
        break
      }
      case 'clear_custom_price': {
        await prisma.organization.update({ where: { id }, data: { customPricing: false } })
        break
      }
      case 'mark_past_due': {
        await markPastDue(id)
        break
      }
      case 'suspend': {
        await markSuspended(id)
        break
      }
      case 'cancel': {
        await cancelSubscription(id)
        break
      }
      case 'reactivate': {
        await prisma.organization.update({
          where: { id },
          data: {
            status: 'ACTIVE',
            pastDueAt: null,
            suspendedAt: null,
            cancelledAt: null,
            gracePeriodEndsAt: null,
          },
        })
        break
      }
    }

    const updated = await prisma.organization.findUniqueOrThrow({
      where: { id },
      select: ORG_BILLING_SELECT,
    })

    await prisma.platformAuditLog.create({
      data: {
        superAdminId: session.superAdmin.id,
        action: 'UPDATE',
        entity: 'OrganizationBilling',
        entityId: id,
        oldValue: toJsonSafe(existing),
        newValue: {
          ...toJsonSafe(updated),
          action: data.action,
          ...(result ? { result: toJsonSafe(result) } : {}),
        },
      },
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (err) {
    if (err instanceof z.ZodError)
      return NextResponse.json({ error: err.errors[0].message }, { status: 400 })
    if (err instanceof SubscriptionError)
      return NextResponse.json({ error: err.message }, { status: 400 })
    console.error(err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
