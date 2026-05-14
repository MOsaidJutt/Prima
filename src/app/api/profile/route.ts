import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireTenantAuth } from '@/lib/auth/require-tenant-auth'
import { TenantScopedRepository } from '@/lib/tenant-context'

const profileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  phone: z.string().max(20).optional().nullable(),
  avatar: z
    .string()
    .url()
    .refine((u) => u.startsWith('https://'), 'Avatar URL must use https://')
    .optional()
    .nullable(),
  preferences: z
    .object({
      theme: z.enum(['light', 'dark', 'system']).optional(),
      emailNotifications: z.boolean().optional(),
      inAppNotifications: z.boolean().optional(),
    })
    .optional(),
})

export async function GET(_req: Request) {
  const auth = await requireTenantAuth()
  if (!auth.ok) return auth.response
  const { userId, organizationId } = auth.session

  const user = await prisma.user.findFirst({
    where: { id: userId, organizationId, deletedAt: null },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      avatar: true,
      preferences: true,
      isMfaEnabled: true,
      lastLoginAt: true,
      createdAt: true,
      role: { select: { id: true, name: true } },
      department: { select: { id: true, name: true } },
    },
  })

  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ success: true, data: user })
}

export async function PATCH(req: Request) {
  const auth = await requireTenantAuth()
  if (!auth.ok) return auth.response
  const { userId, organizationId } = auth.session

  try {
    const body = await req.json()
    const data = profileSchema.parse(body)

    const existing = await prisma.user.findFirst({
      where: { id: userId, organizationId, deletedAt: null },
      select: { preferences: true },
    })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const mergedPrefs = {
      ...(existing.preferences as object),
      ...(data.preferences ?? {}),
    }

    const repo = new TenantScopedRepository({ organizationId, userId })
    const updated = await repo.scoped(prisma.user).update({
      where: { id: userId },
      data: {
        name: data.name,
        phone: data.phone,
        avatar: data.avatar,
        preferences: mergedPrefs,
      },
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (err) {
    if (err instanceof z.ZodError)
      return NextResponse.json({ error: err.errors[0].message }, { status: 400 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
