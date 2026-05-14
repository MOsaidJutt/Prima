import type { SuperAdminSession } from '@/types'
import { NextResponse } from 'next/server'

// ── Super Admin permission helpers ────────────────────────────────────────────
// Phase 1 adds a full tenant permission system (slugs, roles, PermissionGate).
// These helpers cover the super-admin panel only.

export function isSuperAdminOwner(session: SuperAdminSession): boolean {
  return session.superAdmin.role === 'OWNER'
}

export function hasSuperAdminPermission(session: SuperAdminSession, permission: string): boolean {
  const perms = session.superAdmin.permissions
  // OWNER with wildcard '*' has all permissions
  if (perms.includes('*')) return true
  return perms.includes(permission)
}

// Guard helper for API routes — returns a 403 response if the check fails,
// or null if the caller may proceed.
export function requireOwner(session: SuperAdminSession | null): NextResponse | null {
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isSuperAdminOwner(session)) {
    return NextResponse.json(
      { error: 'Forbidden: this action requires Owner role' },
      { status: 403 }
    )
  }
  return null
}

export function requireSuperAdminPermission(
  session: SuperAdminSession | null,
  permission: string
): NextResponse | null {
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasSuperAdminPermission(session, permission)) {
    return NextResponse.json(
      { error: `Forbidden: missing permission '${permission}'` },
      { status: 403 }
    )
  }
  return null
}
