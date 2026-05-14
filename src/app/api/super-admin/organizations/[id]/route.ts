import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getSuperAdminSession } from '@/lib/auth/session'
import { requireOwner } from '@/lib/auth/permissions'

const patchSchema = z.object({
  status: z.enum(['TRIAL', 'ACTIVE', 'PAST_DUE', 'SUSPENDED', 'CANCELLED']).optional(),
  plan: z.enum(['STARTER', 'PRO', 'BUSINESS', 'ENTERPRISE']).optional(),
  name: z.string().min(2).optional(),
})

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSuperAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  try {
    const body = await request.json()
    const data = patchSchema.parse(body)

    const org = await prisma.organization.findFirst({ where: { id, deletedAt: null } })
    if (!org) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const updated = await prisma.organization.update({ where: { id }, data })

    await prisma.platformAuditLog.create({
      data: {
        superAdminId: session.superAdmin.id,
        action: 'UPDATE',
        entity: 'Organization',
        entityId: id,
        oldValue: { status: org.status, plan: org.plan, name: org.name },
        newValue: data,
      },
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (err) {
    if (err instanceof z.ZodError)
      return NextResponse.json({ error: err.errors[0].message }, { status: 400 })
    console.error(err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  // C-3: cancelling an org is OWNER-only
  const session = await getSuperAdminSession()
  const denied = requireOwner(session)
  if (denied || !session)
    return denied ?? NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  // H-6: capture state before mutation for audit log
  const org = await prisma.organization.findFirst({ where: { id, deletedAt: null } })
  if (!org) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // H-4: soft delete — set deletedAt instead of status only
  await prisma.organization.update({
    where: { id },
    data: { status: 'CANCELLED', deletedAt: new Date() },
  })

  await prisma.platformAuditLog.create({
    data: {
      superAdminId: session.superAdmin.id,
      action: 'DELETE',
      entity: 'Organization',
      entityId: id,
      oldValue: { name: org.name, status: org.status, plan: org.plan, slug: org.slug },
      newValue: { status: 'CANCELLED', deletedAt: new Date().toISOString() },
    },
  })

  return NextResponse.json({ success: true })
}
