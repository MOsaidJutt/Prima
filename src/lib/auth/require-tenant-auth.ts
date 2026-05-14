import { NextResponse } from 'next/server'
import { getTenantSession } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'
import { hasPermission } from '@/lib/permissions'
import type { PermissionSlug } from '@/lib/permissions'
import type { TenantSession, UserWithRole } from '@/types'

// ── Auth result types ─────────────────────────────────────────────────────────

export type AuthSuccess = {
  ok: true
  session: TenantSession
  user: UserWithRole
}

export type AuthFailure = {
  ok: false
  response: NextResponse
}

export type AuthResult = AuthSuccess | AuthFailure

// ── requireTenantAuth ─────────────────────────────────────────────────────────
// Every tenant API route calls this. It:
//   1. Verifies the JWT session cookie.
//   2. Fetches User + Role + Department from DB (ground truth — never stale).
//   3. Checks isActive and soft-delete state.
//   4. If a slug is provided, verifies the permission.
//
// Trade-off (documented intentionally): the JWT embeds permissions[] for
// client-side gating. Those may lag until the next login if a role changes.
// The API enforces the DB state on every request — there is no lag here.

export async function requireTenantAuth(slug?: PermissionSlug): Promise<AuthResult> {
  const session = await getTenantSession()
  if (!session) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    }
  }

  const user = await prisma.user.findFirst({
    where: {
      id: session.userId,
      organizationId: session.organizationId,
      deletedAt: null,
      isActive: true,
    },
    include: {
      role: true,
      department: true,
    },
  })

  if (!user) {
    // userId may be a Phase 0 placeholder (org.id). Either way: 401.
    return {
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    }
  }

  if (slug) {
    const allowed = hasPermission(user.role.permissions, slug)
    if (!allowed) {
      return {
        ok: false,
        response: NextResponse.json({ error: 'Forbidden', required: slug }, { status: 403 }),
      }
    }
  }

  return { ok: true, session, user }
}

// ── Ownership check helper ────────────────────────────────────────────────────
// Used with *_own slugs. Returns true if:
//   a) the user holds the *_any variant of the slug, OR
//   b) the record belongs to this user.
// Handlers must call this AFTER requireTenantAuth has already verified the
// *_own slug. Passing `anySlug` short-circuits so managers aren't blocked.

export function canActOnRecord(
  userPermissions: string[],
  anySlug: PermissionSlug,
  recordUserId: string | null | undefined,
  authenticatedUserId: string
): boolean {
  if (hasPermission(userPermissions, anySlug)) return true
  return recordUserId === authenticatedUserId
}
