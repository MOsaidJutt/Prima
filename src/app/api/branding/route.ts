import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireTenantAuth } from '@/lib/auth/require-tenant-auth'
import { createAuditLog } from '@/lib/audit'

const hexColor = z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Must be a valid hex color')

const brandingSchema = z.object({
  logoLight: z.string().url().optional().nullable(),
  logoDark: z.string().url().optional().nullable(),
  favicon: z.string().url().optional().nullable(),
  primaryColor: hexColor.optional(),
  secondaryColor: hexColor.optional(),
  accentColor: hexColor.optional(),
  fontFamily: z.string().max(60).optional(),
  emailBannerUrl: z.string().url().optional().nullable(),
  emailFooterText: z.string().max(500).optional().nullable(),
  loginCustomText: z.string().max(300).optional().nullable(),
  loginBgImage: z.string().url().optional().nullable(),
})

export async function GET(_req: Request) {
  const auth = await requireTenantAuth('organization:read')
  if (!auth.ok) return auth.response
  const { organizationId } = auth.session

  const org = await prisma.organization.findFirst({
    where: { id: organizationId, deletedAt: null },
    select: {
      logoLight: true,
      logoDark: true,
      favicon: true,
      primaryColor: true,
      secondaryColor: true,
      accentColor: true,
      fontFamily: true,
      emailBannerUrl: true,
      emailFooterText: true,
      loginCustomText: true,
      loginBgImage: true,
    },
  })

  if (!org) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ success: true, data: org })
}

export async function PUT(req: Request) {
  const auth = await requireTenantAuth('branding:update')
  if (!auth.ok) return auth.response
  const { organizationId, userId } = auth.session

  try {
    const body = await req.json()
    const data = brandingSchema.parse(body)

    const before = await prisma.organization.findFirst({
      where: { id: organizationId },
      select: { primaryColor: true, secondaryColor: true, accentColor: true, fontFamily: true },
    })

    await prisma.organization.update({
      where: { id: organizationId },
      data: { ...data, updatedAt: new Date() },
    })

    await createAuditLog({
      organizationId,
      userId,
      action: 'BRANDING_CHANGE',
      entity: 'Organization',
      entityId: organizationId,
      oldValue: before,
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
