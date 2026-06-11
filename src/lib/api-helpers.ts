import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { requireTenantAuth } from '@/lib/auth/require-tenant-auth'
import { TenantScopedRepository, TenantContext } from '@/lib/tenant-context'
import { prisma } from '@/lib/prisma'
import type { PermissionSlug } from '@/lib/permissions'

export type ApiContext = {
  ctx: TenantContext
  repo: TenantScopedRepository
  user: { id: string; name: string; permissions: string[] }
  org: { id: string; slug: string; name: string }
  req: Request
}

export type TenantApiOptions = {
  // Phase 6: billing routes (and similar "manage your way out of suspension"
  // flows) must remain reachable even when the org is SUSPENDED/CANCELLED.
  bypassSubscriptionCheck?: boolean
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

// H-1: withTenantApi delegates entirely to requireTenantAuth.
// All auth logic lives in one place; security patches propagate automatically.

export async function withTenantApi(
  req: Request,
  requiredPermission: PermissionSlug | null,
  handler: (apiCtx: ApiContext) => Promise<NextResponse>,
  options: TenantApiOptions = {}
): Promise<NextResponse> {
  const auth = await requireTenantAuth(requiredPermission ?? undefined)
  if (!auth.ok) return auth.response

  // Phase 6: subscription-lifecycle enforcement, using fresh (non-JWT) org status.
  if (!options.bypassSubscriptionCheck) {
    if (auth.org.status === 'CANCELLED') {
      return apiError(
        "This organization's subscription has been cancelled. Visit Billing to reactivate.",
        403
      )
    }
    if (auth.org.status === 'SUSPENDED' && !SAFE_METHODS.has(req.method.toUpperCase())) {
      return apiError(
        'This organization is suspended due to non-payment. Visit Billing to restore access.',
        403
      )
    }
  }

  const ctx: TenantContext = {
    organizationId: auth.session.organizationId,
    userId: auth.user.id,
  }

  try {
    return await handler({
      ctx,
      repo: new TenantScopedRepository(ctx),
      user: { id: auth.user.id, name: auth.user.name, permissions: auth.user.role.permissions },
      // org comes from the JWT session (already validated by requireTenantAuth)
      org: {
        id: auth.session.organization.id,
        slug: auth.session.organization.slug,
        name: auth.session.organization.name,
      },
      req,
    })
  } catch (err) {
    // M-1: surface known Prisma errors with meaningful HTTP status codes
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === 'P2002') {
        return NextResponse.json(
          { error: 'A record with this value already exists.' },
          { status: 409 }
        )
      }
      if (err.code === 'P2025') {
        return NextResponse.json({ error: 'Record not found.' }, { status: 404 })
      }
      if (err.code === 'P2003') {
        return NextResponse.json({ error: 'Related record not found.' }, { status: 422 })
      }
    }
    // M-7: report unexpected errors to Sentry; import is dynamic so the module
    // loads even when SENTRY_DSN is not configured (no-op in that case).
    import('@sentry/nextjs').then(({ captureException }) => captureException(err)).catch(() => {})
    console.error('[API Error]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export function apiOk<T>(data: T, status = 200) {
  return NextResponse.json(data, { status })
}

export function apiError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}

// C-3: generateEntityCode finds the highest existing code number via findFirst+orderBy,
// which avoids the count()-based TOCTOU race. Includes soft-deleted rows so codes
// are never reused. The @@unique constraint is the final safety net — a concurrent
// duplicate will surface as a P2002, which withTenantApi now maps to 409.

export async function generateEntityCode(
  orgId: string,
  prefix: string,
  model: 'distributor' | 'client' | 'warehouse'
): Promise<string> {
  // Each model stores codes like "DST-0001". We orderBy code DESC and take 1,
  // so the highest-numbered code is always in position 0.
  let lastCode: string | null = null

  if (model === 'distributor') {
    const row = await prisma.distributor.findFirst({
      where: { organizationId: orgId, code: { startsWith: `${prefix}-` } },
      orderBy: { code: 'desc' },
      select: { code: true },
    })
    lastCode = row?.code ?? null
  } else if (model === 'client') {
    const row = await prisma.client.findFirst({
      where: { organizationId: orgId, code: { startsWith: `${prefix}-` } },
      orderBy: { code: 'desc' },
      select: { code: true },
    })
    lastCode = row?.code ?? null
  } else if (model === 'warehouse') {
    const row = await prisma.warehouse.findFirst({
      where: { organizationId: orgId, code: { startsWith: `${prefix}-` } },
      orderBy: { code: 'desc' },
      select: { code: true },
    })
    lastCode = row?.code ?? null
  }
  // Note: products use sku (not code) and auto-generate via the route itself,
  // so `model === 'product'` is intentionally not handled here.

  const lastNum = lastCode ? parseInt(lastCode.split('-').pop() ?? '0', 10) : 0
  const nextNum = isNaN(lastNum) ? 1 : lastNum + 1
  return `${prefix}-${String(nextNum).padStart(4, '0')}`
}
