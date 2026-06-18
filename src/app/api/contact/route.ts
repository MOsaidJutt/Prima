import { NextResponse } from 'next/server'
import { z } from 'zod'
import { checkContactRateLimit } from '@/lib/rate-limit'
import { sendContactFormEmail } from '@/lib/email'

const contactSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(254),
  company: z.string().trim().max(160).optional(),
  message: z.string().trim().min(10).max(4000),
})

export async function POST(req: Request) {
  const rateLimited = await checkContactRateLimit(req)
  if (rateLimited) return rateLimited

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const parsed = contactSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  try {
    await sendContactFormEmail(parsed.data)
  } catch (err) {
    console.error('[contact] failed to send email', err)
    return NextResponse.json(
      { error: 'Failed to send your message. Please try again.' },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true })
}
