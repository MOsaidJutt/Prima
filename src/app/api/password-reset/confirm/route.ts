import { NextResponse } from 'next/server'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { createAuditLog } from '@/lib/audit'
import { BCRYPT_ROUNDS_PASSWORD } from '@/lib/constants'

const schema = z.object({
  token: z.string().min(1),
  password: z
    .string()
    .min(8)
    .regex(/[A-Z]/, 'Must contain an uppercase letter')
    .regex(/[0-9]/, 'Must contain a number'),
})

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { token, password } = schema.parse(body)

    const tokenPrefix = token.slice(0, 8)
    const candidates = await prisma.passwordResetToken.findMany({
      where: { tokenPrefix, usedAt: null, expiresAt: { gt: new Date() } },
      include: {
        user: { select: { id: true, organizationId: true, email: true, deletedAt: true } },
      },
    })

    let matched: (typeof candidates)[number] | null = null
    for (const c of candidates) {
      if (await bcrypt.compare(token, c.tokenHash)) {
        matched = c
        break
      }
    }

    if (!matched || matched.user.deletedAt) {
      return NextResponse.json({ error: 'Invalid or expired reset link.' }, { status: 400 })
    }

    const hash = await bcrypt.hash(password, BCRYPT_ROUNDS_PASSWORD)

    await prisma.$transaction([
      prisma.passwordResetToken.update({
        where: { id: matched.id },
        data: { usedAt: new Date() },
      }),
      prisma.user.update({
        where: { id: matched.user.id },
        data: { passwordHash: hash, lastModifiedBy: matched.user.id },
      }),
    ])

    await createAuditLog({
      organizationId: matched.user.organizationId,
      userId: matched.user.id,
      action: 'PASSWORD_RESET',
      entity: 'User',
      entityId: matched.user.id,
      req,
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    if (err instanceof z.ZodError)
      return NextResponse.json({ error: err.errors[0].message }, { status: 400 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
