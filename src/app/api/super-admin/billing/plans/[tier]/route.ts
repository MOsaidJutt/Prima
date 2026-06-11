import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { SubscriptionPlan } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getSuperAdminSession } from '@/lib/auth/session'
import { requireOwner } from '@/lib/auth/permissions'
import { toJsonSafe } from '@/lib/utils'

const TIERS: SubscriptionPlan[] = ['STARTER', 'PRO', 'BUSINESS', 'ENTERPRISE']

const patchPlanSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  monthlyPrice: z.number().min(0).optional(),
  annualPrice: z.number().min(0).optional(),
  setupFee: z.number().min(0).optional(),
  maxUsers: z.number().int().positive().nullable().optional(),
  aiTokensIncluded: z.number().int().min(0).optional(),
  aiEnabled: z.boolean().optional(),
  perUserQuotasEnabled: z.boolean().optional(),
  invoiceTemplateLimit: z.number().int().positive().nullable().optional(),
  customDomain: z.boolean().optional(),
  prioritySupport: z.boolean().optional(),
  sla: z.string().nullable().optional(),
  features: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
})

function parseTier(tier: string): SubscriptionPlan | null {
  return TIERS.includes(tier as SubscriptionPlan) ? (tier as SubscriptionPlan) : null
}

export async function GET(_req: Request, { params }: { params: Promise<{ tier: string }> }) {
  const session = await getSuperAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { tier: tierParam } = await params
  const tier = parseTier(tierParam.toUpperCase())
  if (!tier) return NextResponse.json({ error: 'Invalid plan tier' }, { status: 400 })

  const plan = await prisma.billingPlan.findUnique({ where: { tier } })
  if (!plan) return NextResponse.json({ error: 'Plan not configured' }, { status: 404 })

  return NextResponse.json({ success: true, data: plan })
}

export async function PATCH(request: Request, { params }: { params: Promise<{ tier: string }> }) {
  const session = await getSuperAdminSession()
  const denied = requireOwner(session)
  if (denied || !session)
    return denied ?? NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { tier: tierParam } = await params
  const tier = parseTier(tierParam.toUpperCase())
  if (!tier) return NextResponse.json({ error: 'Invalid plan tier' }, { status: 400 })

  try {
    const body = await request.json()
    const data = patchPlanSchema.parse(body)

    const existing = await prisma.billingPlan.findUnique({ where: { tier } })
    if (!existing) return NextResponse.json({ error: 'Plan not configured' }, { status: 404 })

    const plan = await prisma.billingPlan.update({ where: { tier }, data })

    await prisma.platformAuditLog.create({
      data: {
        superAdminId: session.superAdmin.id,
        action: 'UPDATE',
        entity: 'BillingPlan',
        entityId: plan.id,
        oldValue: toJsonSafe(existing),
        newValue: data,
      },
    })

    return NextResponse.json({ success: true, data: plan })
  } catch (err) {
    if (err instanceof z.ZodError)
      return NextResponse.json({ error: err.errors[0].message }, { status: 400 })
    console.error(err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
