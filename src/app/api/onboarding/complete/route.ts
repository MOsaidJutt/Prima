import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getTenantSession } from '@/lib/auth/session'

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

  const { organizationId } = session

  // Ensure org exists and is not deleted
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

    await prisma.organization.update({
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

    // Invite emails are stored for Phase 1c when the User model exists.
    // For now we just acknowledge them.

    return NextResponse.json({ success: true, redirect: '/admin' })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors[0].message }, { status: 400 })
    }
    console.error('[onboarding/complete]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
