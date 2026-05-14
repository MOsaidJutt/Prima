import { NextResponse } from 'next/server'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { nanoid } from 'nanoid'
import { prisma } from '@/lib/prisma'
import { requireTenantAuth } from '@/lib/auth/require-tenant-auth'
import { sendUserInvite } from '@/lib/email'
import { createAuditLog } from '@/lib/audit'
import { createNotification } from '@/lib/notifications'

const INVITE_TTL_HOURS = 48

const inviteSchema = z.object({
  email: z.string().email(),
  name: z.string().max(100).optional(),
  roleId: z.string().uuid(),
  departmentId: z.string().uuid().optional().nullable(),
})

export async function POST(req: Request) {
  const auth = await requireTenantAuth('users:invite')
  if (!auth.ok) return auth.response
  const { organizationId, userId } = auth.session
  const { user: inviter } = auth

  try {
    const body = await req.json()
    const data = inviteSchema.parse(body)

    // Verify role belongs to this org
    const role = await prisma.role.findFirst({
      where: { id: data.roleId, organizationId, deletedAt: null },
    })
    if (!role) return NextResponse.json({ error: 'Role not found' }, { status: 404 })

    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: { email: data.email, organizationId, deletedAt: null },
    })
    if (existingUser) {
      return NextResponse.json({ error: 'A user with this email already exists.' }, { status: 409 })
    }

    // Check for existing pending invitation
    const pendingInvite = await prisma.userInvitation.findFirst({
      where: {
        email: data.email,
        organizationId,
        acceptedAt: null,
        expiresAt: { gt: new Date() },
      },
    })
    if (pendingInvite) {
      return NextResponse.json(
        { error: 'A pending invitation already exists for this email.' },
        { status: 409 }
      )
    }

    const rawToken = nanoid(48)
    const tokenHash = await bcrypt.hash(rawToken, 10)
    const expiresAt = new Date(Date.now() + INVITE_TTL_HOURS * 60 * 60 * 1000)

    await prisma.userInvitation.create({
      data: {
        organizationId,
        email: data.email,
        name: data.name,
        roleId: data.roleId,
        departmentId: data.departmentId ?? null,
        invitedBy: userId,
        tokenHash,
        expiresAt,
      },
    })

    // Get org name for email
    const org = await prisma.organization.findFirst({
      where: { id: organizationId },
      select: { name: true },
    })

    // Fire-and-forget email
    sendUserInvite({
      to: data.email,
      orgName: org?.name ?? 'your organization',
      inviteToken: rawToken,
      inviterName: inviter.name,
      roleName: role.name,
    }).catch((err: unknown) => console.error('[user-invite-email]', err))

    await createAuditLog({
      organizationId,
      userId,
      action: 'INVITE',
      entity: 'User',
      newValue: { email: data.email, roleId: data.roleId },
      req,
    })

    // Notify other admins
    await createNotification({
      organizationId,
      userId,
      type: 'user_invited',
      title: 'Invitation sent',
      body: `${data.email} has been invited as ${role.name}.`,
    })

    return NextResponse.json({ success: true }, { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError)
      return NextResponse.json({ error: err.errors[0].message }, { status: 400 })
    console.error('[invite POST]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
