import { NextResponse } from 'next/server'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { createTenantToken, setSessionCookie } from '@/lib/auth/session'
import { DEFAULT_ROLES } from '@/lib/permissions'
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
    const candidates = await prisma.organizationInvitation.findMany({
      where: { acceptedAt: null, expiresAt: { gt: new Date() } },
      include: {
        organization: {
          select: {
            id: true,
            slug: true,
            name: true,
            status: true,
            plan: true,
            deletedAt: true,
            adminEmail: true,
            adminName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    let matched: (typeof candidates)[number] | null = null
    for (const candidate of candidates) {
      if (await bcrypt.compare(token, candidate.tokenHash)) {
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

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS)

    // Create default system roles + Owner user in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Mark invitation accepted
      await tx.organizationInvitation.update({
        where: { id: matched!.id },
        data: { acceptedAt: new Date() },
      })

      // 2. Create default roles (idempotent — skip if already exist)
      const existingRoles = await tx.role.findMany({
        where: { organizationId: org.id, isSystem: true, deletedAt: null },
        select: { name: true, id: true },
      })
      const existingRoleNames = new Set(existingRoles.map((r) => r.name))

      const createdRoles: { name: string; id: string }[] = [...existingRoles]

      for (const roleDef of DEFAULT_ROLES) {
        if (!existingRoleNames.has(roleDef.name)) {
          const created = await tx.role.create({
            data: {
              organizationId: org.id,
              name: roleDef.name,
              description: roleDef.description,
              isSystem: roleDef.isSystem,
              permissions: roleDef.permissions as string[],
            },
          })
          createdRoles.push({ name: created.name, id: created.id })
        }
      }

      const ownerRole = createdRoles.find((r) => r.name === 'Owner')
      if (!ownerRole) throw new Error('Owner role not found after creation')

      // 3. Create Owner User for the org admin
      const existingUser = await tx.user.findFirst({
        where: { organizationId: org.id, email: matched!.email, deletedAt: null },
      })

      let adminUser: { id: string; roleId: string }
      if (existingUser) {
        adminUser = existingUser
      } else {
        adminUser = await tx.user.create({
          data: {
            organizationId: org.id,
            roleId: ownerRole.id,
            email: matched!.email,
            name: org.adminName ?? matched!.email.split('@')[0],
            passwordHash,
            isActive: true,
          },
        })
      }

      // 4. Store hash on Organization too (Phase 0 fallback) + null the hash later in Phase 7
      await tx.organization.update({
        where: { id: org.id },
        data: { adminPasswordHash: passwordHash },
      })

      return { adminUser, ownerRole, createdRoles }
    })

    // Build Phase 1c session with real userId + permissions
    const ownerRoleFull = await prisma.role.findUnique({ where: { id: result.ownerRole.id } })
    const sessionToken = await createTenantToken({
      type: 'tenant',
      userId: result.adminUser.id,
      organizationId: org.id,
      organization: {
        id: org.id,
        slug: org.slug,
        name: org.name,
        status: org.status,
        plan: org.plan,
      },
      role: {
        id: result.ownerRole.id,
        name: 'Owner',
        isSystem: true,
      },
      permissions: ownerRoleFull?.permissions ?? ['*'],
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
