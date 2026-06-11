import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getSuperAdminSession } from '@/lib/auth/session'
import { requireOwner } from '@/lib/auth/permissions'
import { toJsonSafe } from '@/lib/utils'

const upsertPlanSchema = z.object({
  tier: z.enum(['STARTER', 'PRO', 'BUSINESS', 'ENTERPRISE']),
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  monthlyPrice: z.number().min(0),
  annualPrice: z.number().min(0),
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

export async function GET() {
  const session = await getSuperAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const plans = await prisma.billingPlan.findMany({ orderBy: { sortOrder: 'asc' } })
  return NextResponse.json({ success: true, data: plans })
}

export async function POST(request: Request) {
  const session = await getSuperAdminSession()
  const denied = requireOwner(session)
  if (denied || !session)
    return denied ?? NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json()
    const data = upsertPlanSchema.parse(body)
    const { tier, ...rest } = data

    const existing = await prisma.billingPlan.findUnique({ where: { tier } })

    const plan = await prisma.billingPlan.upsert({
      where: { tier },
      create: { tier, ...rest },
      update: rest,
    })

    await prisma.platformAuditLog.create({
      data: {
        superAdminId: session.superAdmin.id,
        action: existing ? 'UPDATE' : 'CREATE',
        entity: 'BillingPlan',
        entityId: plan.id,
        oldValue: existing ? toJsonSafe(existing) : undefined,
        newValue: data,
      },
    })

    return NextResponse.json({ success: true, data: plan }, { status: existing ? 200 : 201 })
  } catch (err) {
    if (err instanceof z.ZodError)
      return NextResponse.json({ error: err.errors[0].message }, { status: 400 })
    console.error(err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
