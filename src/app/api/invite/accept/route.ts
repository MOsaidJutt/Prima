import { NextResponse } from 'next/server'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { createTenantToken, setSessionCookie } from '@/lib/auth/session'
import { createAuditLog } from '@/lib/audit'
import { cookies } from 'next/headers'
import { BCRYPT_ROUNDS_PASSWORD } from '@/lib/constants'

const acceptSchema = z.object({
  token: z.string().min(1),
  name: z.string().min(1).max(100),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Must contain an uppercase letter')
    .regex(/[0-9]/, 'Must contain a number'),
})

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { token, name, password } = acceptSchema.parse(body)

    // Pre-filter by tokenPrefix (O(1) indexed lookup) before running bcrypt.compare()
    // This eliminates the brute-force amplification vector where each request could
    // trigger up to 100 bcrypt comparisons against all pending invitations.
    const tokenPrefix = token.slice(0, 8)
    const candidates = await prisma.userInvitation.findMany({
      where: { tokenPrefix, acceptedAt: null, expiresAt: { gt: new Date() } },
      include: {
        organization: {
          select: { id: true, slug: true, name: true, status: true, plan: true, deletedAt: true },
        },
        role: true,
      },
    })

    let matched: (typeof candidates)[number] | null = null
    for (const c of candidates) {
      if (await bcrypt.compare(token, c.tokenHash)) {
        matched = c
        break
      }
    }

    if (!matched) {
      return NextResponse.json({ error: 'Invalid or expired invitation link.' }, { status: 400 })
    }

    const org = matched.organization
    if (org.deletedAt) {
      return NextResponse.json({ error: 'This organization is no longer active.' }, { status: 400 })
    }
    if (org.status === 'SUSPENDED' || org.status === 'CANCELLED') {
      return NextResponse.json({ error: 'This organization is suspended.' }, { status: 400 })
    }

    // Check for pre-existing user
    const existingUser = await prisma.user.findFirst({
      where: { email: matched.email, organizationId: org.id, deletedAt: null },
    })
    if (existingUser) {
      return NextResponse.json(
        { error: 'An account already exists for this email.' },
        { status: 409 }
      )
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS_PASSWORD)

    const newUser = await prisma.$transaction(async (tx) => {
      await tx.userInvitation.update({
        where: { id: matched!.id },
        data: { acceptedAt: new Date() },
      })

      return tx.user.create({
        data: {
          organizationId: org.id,
          roleId: matched!.roleId,
          departmentId: matched!.departmentId ?? null,
          email: matched!.email,
          name: name ?? matched!.name ?? matched!.email.split('@')[0],
          passwordHash,
          isActive: true,
        },
      })
    })

    await createAuditLog({
      organizationId: org.id,
      userId: newUser.id,
      action: 'CREATE',
      entity: 'User',
      entityId: newUser.id,
      newValue: { email: newUser.email, roleId: newUser.roleId },
      req: request,
    })

    // Create session for the new user
    const sessionToken = await createTenantToken({
      type: 'tenant',
      userId: newUser.id,
      organizationId: org.id,
      organization: {
        id: org.id,
        slug: org.slug,
        name: org.name,
        status: org.status,
        plan: org.plan,
      },
      role: { id: matched.role.id, name: matched.role.name, isSystem: matched.role.isSystem },
      permissions: matched.role.permissions,
      sessionToken: crypto.randomUUID(),
    })

    const cookieStore = await cookies()
    const opts = setSessionCookie('tenant', sessionToken)
    cookieStore.set(opts.name, opts.value, opts)

    return NextResponse.json({ success: true, redirect: '/admin' })
  } catch (err) {
    if (err instanceof z.ZodError)
      return NextResponse.json({ error: err.errors[0].message }, { status: 400 })
    console.error('[invite/accept]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
