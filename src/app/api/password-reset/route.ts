import { NextResponse } from 'next/server'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { nanoid } from 'nanoid'
import { prisma } from '@/lib/prisma'
import { sendPasswordReset } from '@/lib/email'
import { checkPasswordResetRateLimit } from '@/lib/rate-limit'

const requestSchema = z.object({ email: z.string().email() })

export async function POST(req: Request) {
  const rateLimited = await checkPasswordResetRateLimit(req)
  if (rateLimited) return rateLimited

  try {
    const body = await req.json()
    const { email } = requestSchema.parse(body)

    const user = await prisma.user.findFirst({
      where: { email: email.toLowerCase().trim(), deletedAt: null, isActive: true },
      select: { id: true, name: true, email: true },
    })

    // Always return success to avoid email enumeration
    if (!user) return NextResponse.json({ success: true })

    const rawToken = nanoid(48)
    const tokenPrefix = rawToken.slice(0, 8)
    const tokenHash = await bcrypt.hash(rawToken, 10)

    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        tokenPrefix,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    })

    sendPasswordReset({ to: user.email, resetToken: rawToken, name: user.name }).catch(
      (err: unknown) => console.error('[password-reset-email]', err)
    )

    return NextResponse.json({ success: true })
  } catch (err) {
    if (err instanceof z.ZodError)
      return NextResponse.json({ error: err.errors[0].message }, { status: 400 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
