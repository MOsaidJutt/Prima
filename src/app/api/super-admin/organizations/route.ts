import { NextResponse } from 'next/server'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { getSuperAdminSession } from '@/lib/auth/session'
import { requireOwner } from '@/lib/auth/permissions'
import { sendOrganizationInvite } from '@/lib/email'
import { nanoid } from 'nanoid'

import { BCRYPT_ROUNDS_TOKEN, INVITE_TTL_HOURS } from '@/lib/constants'

const createOrgSchema = z.object({
  name: z.string().min(2).max(100),
  slug: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9-]+$/),
  email: z.string().email(),
  adminName: z.string().optional(),
  phone: z.string().optional(),
  city: z.string().optional(),
  plan: z.enum(['STARTER', 'PRO', 'BUSINESS', 'ENTERPRISE']).default('STARTER'),
})

export async function POST(request: Request) {
  // C-3: creating an org is OWNER-only; sub-admins may view but not create
  const session = await getSuperAdminSession()
  const denied = requireOwner(session)
  if (denied || !session)
    return denied ?? NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json()
    const data = createOrgSchema.parse(body)

    const existing = await prisma.organization.findUnique({ where: { slug: data.slug } })
    if (existing) {
      return NextResponse.json({ error: 'Slug already taken' }, { status: 400 })
    }

    const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
    const inviteToken = nanoid(48)
    const tokenPrefix = inviteToken.slice(0, 8)
    const tokenHash = await bcrypt.hash(inviteToken, BCRYPT_ROUNDS_TOKEN)
    const inviteExpiresAt = new Date(Date.now() + INVITE_TTL_HOURS * 60 * 60 * 1000)

    // C-1: org + invitation created atomically
    const org = await prisma.$transaction(async (tx) => {
      const created = await tx.organization.create({
        data: {
          name: data.name,
          slug: data.slug,
          email: data.email,
          adminEmail: data.email,
          adminName: data.adminName,
          phone: data.phone,
          city: data.city,
          plan: data.plan,
          status: 'TRIAL',
          trialEndsAt,
        },
      })

      await tx.organizationInvitation.create({
        data: {
          organizationId: created.id,
          email: data.email,
          tokenHash,
          tokenPrefix,
          expiresAt: inviteExpiresAt,
        },
      })

      return created
    })

    await prisma.platformAuditLog.create({
      data: {
        superAdminId: session.superAdmin.id,
        action: 'CREATE',
        entity: 'Organization',
        entityId: org.id,
        newValue: { name: org.name, slug: org.slug, plan: org.plan },
      },
    })

    // Send invitation email (non-blocking — DB is the source of truth, not the email)
    sendOrganizationInvite({
      to: data.email,
      orgName: data.name,
      inviteToken,
      adminName: data.adminName,
    }).catch((err: unknown) => console.error('[invite-email]', err))

    return NextResponse.json(
      { success: true, data: { id: org.id, slug: org.slug } },
      { status: 201 }
    )
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors[0].message }, { status: 400 })
    }
    console.error(err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(request: Request) {
  const session = await getSuperAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')
  // M-2: guard against NaN (e.g. ?page=abc) — parseInt returns NaN which Prisma silently treats as 0
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1') || 1)
  const pageSize = 20

  const where = q
    ? {
        OR: [
          { name: { contains: q, mode: 'insensitive' as const } },
          { slug: { contains: q, mode: 'insensitive' as const } },
        ],
      }
    : undefined

  const [orgs, total] = await Promise.all([
    prisma.organization.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.organization.count({ where }),
  ])

  return NextResponse.json({ success: true, data: orgs, total, page, pageSize })
}
