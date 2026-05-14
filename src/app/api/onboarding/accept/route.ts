import { NextResponse } from 'next/server'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { createTenantToken, setSessionCookie } from '@/lib/auth/session'
import { cookies } from 'next/headers'

const BCRYPT_ROUNDS = 12

const acceptSchema = z.object({
  token: z.string().min(1),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Must contain an uppercase letter')
    .regex(/[0-9]/, 'Must contain a number'),
})

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { token, password } = acceptSchema.parse(body)

    // Find all non-expired, non-accepted invitations and compare token hashes.
    // We can't query by tokenHash directly (it's a bcrypt hash), so we check
    // recent invitations for this token. This is intentionally limited to
    // invitations created in the last 48 hours.
    const candidates = await prisma.organizationInvitation.findMany({
      where: {
        acceptedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: {
        organization: {
          select: { id: true, slug: true, name: true, status: true, plan: true, deletedAt: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50, // safety cap — very few pending invitations at any time
    })

    // Find the matching invitation by comparing the raw token against stored hashes
    let matched: (typeof candidates)[number] | null = null
    for (const candidate of candidates) {
      const valid = await bcrypt.compare(token, candidate.tokenHash)
      if (valid) {
        matched = candidate
        break
      }
    }

    if (!matched) {
      return NextResponse.json(
        { error: 'Invalid or expired invitation link. Ask your admin to resend the invite.' },
        { status: 400 }
      )
    }

    const org = matched.organization
    if (org.deletedAt) {
      return NextResponse.json({ error: 'This organization has been cancelled.' }, { status: 400 })
    }

    const adminPasswordHash = await bcrypt.hash(password, BCRYPT_ROUNDS)

    // Mark invitation accepted and set admin password — atomically
    await prisma.$transaction([
      prisma.organizationInvitation.update({
        where: { id: matched.id },
        data: { acceptedAt: new Date() },
      }),
      prisma.organization.update({
        where: { id: org.id },
        data: { adminPasswordHash },
      }),
    ])

    // Create a session so the admin lands directly in onboarding
    const sessionToken = await createTenantToken({
      type: 'tenant',
      userId: org.id, // Phase 0 placeholder; replaced by User.id in Phase 1c
      organizationId: org.id,
      organization: {
        id: org.id,
        slug: org.slug,
        name: org.name,
        status: org.status,
        plan: org.plan,
      },
      sessionToken: crypto.randomUUID(),
    })

    const cookieStore = await cookies()
    const opts = setSessionCookie('tenant', sessionToken)
    cookieStore.set(opts.name, opts.value, opts)

    return NextResponse.json({ success: true, redirect: '/onboarding' })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors[0].message }, { status: 400 })
    }
    console.error('[onboarding/accept]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
