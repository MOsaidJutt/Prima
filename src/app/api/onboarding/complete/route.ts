import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getTenantSession } from '@/lib/auth/session'
import { createAuditLog } from '@/lib/audit'

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

  try {
    const body = await request.json()
    const data = completeSchema.parse(body)

    // Look up Sales Rep role for onboarding invites
    const salesRepRole = await prisma.role.findFirst({
      where: { organizationId, name: 'Sales Rep', deletedAt: null },
      select: { id: true },
    })

    await prisma.$transaction(async (tx) => {
      // Update org profile + branding
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

      // Create first department
      if (data.departmentName) {
        await tx.department.create({
          data: {
            organizationId,
            name: data.departmentName,
            managerId: userId !== organizationId ? userId : null, // skip if Phase 0 placeholder
            lastModifiedBy: userId,
          },
        })
      }

      // Create invitations for onboarding invite emails (bulk, Sales Rep role default)
      if (data.inviteEmails && salesRepRole) {
        const emails = data.inviteEmails
          .split('\n')
          .map((e) => e.trim().toLowerCase())
          .filter((e) => e.includes('@'))

        // Only invite if user doesn't already exist in org
        for (const email of emails) {
          const existing = await tx.user.findFirst({
            where: { organizationId, email, deletedAt: null },
          })
          if (!existing && userId !== organizationId) {
            const { nanoid } = await import('nanoid')
            const { default: bcrypt } = await import('bcryptjs')
            const raw = nanoid(48)
            const tokenHash = await bcrypt.hash(raw, 10)
            await tx.userInvitation.create({
              data: {
                organizationId,
                email,
                roleId: salesRepRole.id,
                invitedBy: userId,
                tokenHash,
                expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
              },
            })
            // Fire-and-forget email (non-blocking)
            import('@/lib/email').then(({ sendUserInvite }) => {
              sendUserInvite({ to: email, orgName: data.name, inviteToken: raw }).catch(
                (err: unknown) => console.error('[invite-email]', err)
              )
            })
          }
        }
      }
    })

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
