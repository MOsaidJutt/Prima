import { NextResponse } from 'next/server'
import { z } from 'zod'
import { checkLoginRateLimit } from '@/lib/rate-limit'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { createTenantToken, setSessionCookie } from '@/lib/auth/session'
import { cookies } from 'next/headers'

// Rate-limited login API route.
// The existing tenantLogin() server action bypasses rate limiting because
// server actions don't expose the client IP. This route is the canonical
// path for all browser-initiated logins going forward.

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export async function POST(req: Request) {
  const rateLimited = await checkLoginRateLimit(req)
  if (rateLimited) return rateLimited

  try {
    const body = await req.json()
    const { email, password } = loginSchema.parse(body)
    const normalizedEmail = email.toLowerCase().trim()

    // Phase 1c path: User model
    const user = await prisma.user.findFirst({
      where: {
        email: normalizedEmail,
        deletedAt: null,
        isActive: true,
        organization: { deletedAt: null },
      },
      include: {
        organization: {
          select: {
            id: true,
            slug: true,
            name: true,
            status: true,
            plan: true,
            onboardingCompleted: true,
          },
        },
        role: { select: { id: true, name: true, isSystem: true, permissions: true } },
      },
    })

    if (user && user.passwordHash) {
      const org = user.organization
      if (org.status === 'SUSPENDED' || org.status === 'CANCELLED') {
        return NextResponse.json(
          { error: 'Your account has been suspended. Contact support.' },
          { status: 403 }
        )
      }

      const valid = await bcrypt.compare(password, user.passwordHash)
      if (!valid) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })

      await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })

      const token = await createTenantToken({
        type: 'tenant',
        userId: user.id,
        organizationId: org.id,
        organization: {
          id: org.id,
          slug: org.slug,
          name: org.name,
          status: org.status,
          plan: org.plan,
        },
        role: { id: user.role.id, name: user.role.name, isSystem: user.role.isSystem },
        permissions: user.role.permissions,
        sessionToken: crypto.randomUUID(),
      })

      const cookieStore = await cookies()
      const opts = setSessionCookie('tenant', token)
      cookieStore.set(opts.name, opts.value, opts)

      return NextResponse.json({
        success: true,
        onboardingCompleted: org.onboardingCompleted,
      })
    }

    // Phase 0 fallback
    const org = await prisma.organization.findFirst({
      where: { adminEmail: normalizedEmail, deletedAt: null },
      select: {
        id: true,
        slug: true,
        name: true,
        status: true,
        plan: true,
        adminPasswordHash: true,
        onboardingCompleted: true,
      },
    })

    if (!org || !org.adminPasswordHash) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    if (org.status === 'SUSPENDED' || org.status === 'CANCELLED') {
      return NextResponse.json(
        { error: 'Your account has been suspended. Contact support.' },
        { status: 403 }
      )
    }

    const valid = await bcrypt.compare(password, org.adminPasswordHash)
    if (!valid) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })

    const token = await createTenantToken({
      type: 'tenant',
      userId: org.id,
      organizationId: org.id,
      organization: {
        id: org.id,
        slug: org.slug,
        name: org.name,
        status: org.status,
        plan: org.plan,
      },
      role: { id: '', name: 'Owner', isSystem: true },
      permissions: ['*'],
      sessionToken: crypto.randomUUID(),
    })

    const cookieStore = await cookies()
    const opts = setSessionCookie('tenant', token)
    cookieStore.set(opts.name, opts.value, opts)

    return NextResponse.json({ success: true, onboardingCompleted: org.onboardingCompleted })
  } catch (err) {
    if (err instanceof z.ZodError)
      return NextResponse.json({ error: err.errors[0].message }, { status: 400 })
    console.error('[auth/login]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
