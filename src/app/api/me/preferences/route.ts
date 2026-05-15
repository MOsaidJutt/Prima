import { NextResponse } from 'next/server'
import { requireTenantAuth } from '@/lib/auth/require-tenant-auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const auth = await requireTenantAuth()
  if (!auth.ok) return auth.response

  const user = await prisma.user.findUnique({
    where: { id: auth.user.id },
    select: { preferences: true },
  })

  return NextResponse.json((user?.preferences as Record<string, unknown>) ?? {})
}

export async function PATCH(req: Request) {
  const auth = await requireTenantAuth()
  if (!auth.ok) return auth.response

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const user = await prisma.user.findUnique({
    where: { id: auth.user.id },
    select: { preferences: true },
  })

  const current = (user?.preferences as Record<string, unknown>) ?? {}
  const merged = { ...current, ...body }

  await prisma.user.update({
    where: { id: auth.user.id },
    // L-1: Prisma's generated Json type rejects plain Record<string,unknown> due to
    // InputJsonValue strictness — the cast is safe because PostgreSQL JSONB accepts any object.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: { preferences: merged as any },
  })

  return NextResponse.json({ ok: true })
}
