import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireTenantAuth } from '@/lib/auth/require-tenant-auth'
import { createAuditLog } from '@/lib/audit'

const orgSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  phone: z.string().max(20).optional().nullable(),
  website: z.string().url().optional().nullable(),
  address: z.string().max(300).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  state: z.string().max(100).optional().nullable(),
  country: z.string().max(2).optional(),
  postalCode: z.string().max(20).optional().nullable(),
  ntn: z.string().max(50).optional().nullable(),
  strn: z.string().max(50).optional().nullable(),
  currency: z.string().max(10).optional(),
  locale: z.string().max(10).optional(),
  timezone: z.string().max(50).optional(),
  dateFormat: z.string().max(20).optional(),
  fiscalYearStart: z.number().int().min(1).max(12).optional(),
  billingEmail: z.string().email().optional().nullable(),
  billingName: z.string().max(100).optional().nullable(),
  billingPhone: z.string().max(20).optional().nullable(),
})

export async function GET(_req: Request) {
  try {
    const auth = await requireTenantAuth('organization:read')
    if (!auth.ok) return auth.response
    const { organizationId } = auth.session

    const org = await prisma.organization.findFirst({
      where: { id: organizationId, deletedAt: null },
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        plan: true,
        email: true,
        phone: true,
        website: true,
        address: true,
        city: true,
        state: true,
        country: true,
        postalCode: true,
        ntn: true,
        strn: true,
        currency: true,
        locale: true,
        timezone: true,
        dateFormat: true,
        fiscalYearStart: true,
        billingEmail: true,
        billingName: true,
        billingPhone: true,
        trialEndsAt: true,
        nextBillingDate: true,
      },
    })

    if (!org) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ success: true, data: org })
  } catch (err) {
    console.error('[organization GET]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  const auth = await requireTenantAuth('organization:update')
  if (!auth.ok) return auth.response
  const { organizationId, userId } = auth.session

  try {
    const body = await req.json()
    const data = orgSchema.parse(body)

    // H-3: capture old value before update for audit diff
    const before = await prisma.organization.findFirst({
      where: { id: organizationId },
      select: {
        name: true,
        phone: true,
        website: true,
        city: true,
        country: true,
        currency: true,
        locale: true,
        timezone: true,
      },
    })

    await prisma.organization.update({
      where: { id: organizationId },
      data: { ...data, updatedAt: new Date() },
    })

    await createAuditLog({
      organizationId,
      userId,
      action: 'UPDATE',
      entity: 'Organization',
      entityId: organizationId,
      oldValue: before ?? undefined,
      newValue: data,
      req,
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    if (err instanceof z.ZodError)
      return NextResponse.json({ error: err.errors[0].message }, { status: 400 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
