import { NextResponse } from 'next/server'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { requireTenantAuth } from '@/lib/auth/require-tenant-auth'
import { createAuditLog } from '@/lib/audit'

const schema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z
    .string()
    .min(8)
    .regex(/[A-Z]/, 'Must contain an uppercase letter')
    .regex(/[0-9]/, 'Must contain a number'),
})

export async function POST(req: Request) {
  const auth = await requireTenantAuth()
  if (!auth.ok) return auth.response
  const { userId, organizationId } = auth.session

  try {
    const body = await req.json()
    const { currentPassword, newPassword } = schema.parse(body)

    const user = await prisma.user.findFirst({
      where: { id: userId, organizationId, deletedAt: null },
      select: { passwordHash: true },
    })
    if (!user || !user.passwordHash) {
      return NextResponse.json({ error: 'No password set on this account.' }, { status: 400 })
    }

    const valid = await bcrypt.compare(currentPassword, user.passwordHash)
    if (!valid)
      return NextResponse.json({ error: 'Current password is incorrect.' }, { status: 400 })

    const hash = await bcrypt.hash(newPassword, 12)
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: hash, lastModifiedBy: userId },
    })

    await createAuditLog({
      organizationId,
      userId,
      action: 'PASSWORD_RESET',
      entity: 'User',
      entityId: userId,
      req,
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    if (err instanceof z.ZodError)
      return NextResponse.json({ error: err.errors[0].message }, { status: 400 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
