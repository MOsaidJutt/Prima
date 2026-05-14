import { NextResponse } from 'next/server'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { nanoid } from 'nanoid'
import { prisma } from '@/lib/prisma'
import { getTenantSession } from '@/lib/auth/session'
import { createAuditLog } from '@/lib/audit'
import { sendUserInvite } from '@/lib/email'
import { BCRYPT_ROUNDS_TOKEN } from '@/lib/constants'

const completeSchema = z.object({
  name: z.string().min(2).max(100),
  phone: z.string().optional(),
  city: z.string().optional(),
  country: z.string().max(2).optional(),
  ntn: z.string().optional(),
  strn: z.string().optional(),
  primaryColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),
  secondaryColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),
  fontFamily: z.string().max(50).optional(),
  departmentName: z.string().min(1).max(100),
  inviteEmails: z.string().optional(),
})

export async function POST(request: Request) {
  try {
    const session = await getTenantSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { organizationId, userId } = session

    const org = await prisma.organization.findFirst({
      where: { id: organizationId, deletedAt: null },
    })
    if (!org) return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    if (org.onboardingCompleted) {
      return NextResponse.json({ error: 'Onboarding already completed' }, { status: 400 })
    }

    const body = await request.json()
    const data = completeSchema.parse(body)

    const salesRepRole = await prisma.role.findFirst({
      where: { organizationId, name: 'Sales Rep', deletedAt: null },
      select: { id: true },
    })

    // Prepare invitations outside the transaction — bcrypt is CPU-bound and slow;
    // running it inside a transaction ties up the DB connection unnecessarily (M-8).
    type PendingInvite = { email: string; rawToken: string; tokenHash: string; tokenPrefix: string }
    const pendingInvites: PendingInvite[] = []

    if (data.inviteEmails && salesRepRole && userId !== organizationId) {
      const emails = data.inviteEmails
        .split('\n')
        .map((e) => e.trim().toLowerCase())
        .filter((e) => e.includes('@'))

      for (const email of emails) {
        const existing = await prisma.user.findFirst({
          where: { organizationId, email, deletedAt: null },
        })
        if (!existing) {
          const rawToken = nanoid(48)
          const tokenPrefix = rawToken.slice(0, 8)
          const tokenHash = await bcrypt.hash(rawToken, BCRYPT_ROUNDS_TOKEN)
          pendingInvites.push({ email, rawToken, tokenHash, tokenPrefix })
        }
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.organization.update({
        where: { id: organizationId },
        data: {
          name: data.name,
          phone: data.phone,
          city: data.city,
          country: data.country,
          ntn: data.ntn,
          strn: data.strn,
          primaryColor: data.primaryColor,
          secondaryColor: data.secondaryColor,
          fontFamily: data.fontFamily,
          onboardingCompleted: true,
          onboardingStep: 4,
        },
      })

      if (data.departmentName) {
        await tx.department.create({
          data: {
            organizationId,
            name: data.departmentName,
            managerId: userId !== organizationId ? userId : null,
            lastModifiedBy: userId,
          },
        })
      }

      if (pendingInvites.length > 0 && salesRepRole) {
        await tx.userInvitation.createMany({
          data: pendingInvites.map((inv) => ({
            organizationId,
            email: inv.email,
            roleId: salesRepRole.id,
            invitedBy: userId,
            tokenHash: inv.tokenHash,
            tokenPrefix: inv.tokenPrefix,
            expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
          })),
          skipDuplicates: true,
        })
      }
    })

    // Fire-and-forget emails after transaction committed
    for (const inv of pendingInvites) {
      sendUserInvite({ to: inv.email, orgName: data.name, inviteToken: inv.rawToken }).catch(
        (err: unknown) => console.error('[onboarding-invite-email]', err)
      )
    }

    await createAuditLog({
      organizationId,
      userId,
      action: 'UPDATE',
      entity: 'Organization',
      entityId: organizationId,
      newValue: { onboardingCompleted: true },
      req: request,
    })

    return NextResponse.json({ success: true, redirect: '/admin' })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors[0].message }, { status: 400 })
    }
    console.error('[onboarding/complete]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
