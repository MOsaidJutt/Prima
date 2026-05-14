import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { nanoid } from 'nanoid'
import { prisma } from '@/lib/prisma'
import { requireTenantAuth } from '@/lib/auth/require-tenant-auth'
import { sendPasswordReset } from '@/lib/email'
import { createAuditLog } from '@/lib/audit'
import { BCRYPT_ROUNDS_TOKEN } from '@/lib/constants'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireTenantAuth('users:update')
    if (!auth.ok) return auth.response
    const { id } = await params
    const { organizationId, userId } = auth.session

    const user = await prisma.user.findFirst({
      where: { id, organizationId, deletedAt: null },
      select: { id: true, email: true, name: true },
    })
    if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const rawToken = nanoid(48)
    const tokenPrefix = rawToken.slice(0, 8)
    const tokenHash = await bcrypt.hash(rawToken, BCRYPT_ROUNDS_TOKEN)

    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        tokenPrefix,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    })

    sendPasswordReset({ to: user.email, resetToken: rawToken, name: user.name }).catch(
      (err: unknown) => console.error('[admin-reset-password]', err)
    )

    await createAuditLog({
      organizationId,
      userId,
      action: 'PASSWORD_RESET',
      entity: 'User',
      entityId: id,
      req,
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[users/[id]/reset-password POST]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
