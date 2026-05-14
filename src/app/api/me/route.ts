import { NextResponse } from 'next/server'
import { requireTenantAuth } from '@/lib/auth/require-tenant-auth'
import { createTenantToken, setSessionCookie } from '@/lib/auth/session'
import { cookies } from 'next/headers'

// Returns the current user and silently refreshes the JWT if role/permissions
// have changed since the token was issued. This is the mechanism for the
// "client JWT lags by one session" trade-off to self-heal without a full re-login.

export async function GET(_req: Request) {
  const auth = await requireTenantAuth()
  if (!auth.ok) return auth.response

  const { user, session } = auth

  const currentPerms = [...user.role.permissions].sort().join(',')
  const sessionPerms = [...(session.permissions ?? [])].sort().join(',')
  const roleChanged = session.role?.id !== user.roleId || currentPerms !== sessionPerms

  if (roleChanged) {
    const newToken = await createTenantToken({
      type: 'tenant',
      userId: user.id,
      organizationId: user.organizationId,
      organization: session.organization,
      role: { id: user.role.id, name: user.role.name, isSystem: user.role.isSystem },
      permissions: user.role.permissions,
      sessionToken: crypto.randomUUID(),
    })
    const cookieStore = await cookies()
    const opts = setSessionCookie('tenant', newToken)
    cookieStore.set(opts.name, opts.value, opts)
  }

  // Use select in requireTenantAuth includes everything safe — passwordHash/mfaSecret
  // are not in the User select in require-tenant-auth (it uses include: { role, department })
  // but User model has all fields. Strip them here.
  const safeUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    avatar: user.avatar,
    isActive: user.isActive,
    isMfaEnabled: user.isMfaEnabled,
    lastLoginAt: user.lastLoginAt,
    preferences: user.preferences,
    organizationId: user.organizationId,
    roleId: user.roleId,
    departmentId: user.departmentId,
    role: user.role,
    department: user.department,
    permissions: user.role.permissions,
  }

  return NextResponse.json({ success: true, data: safeUser })
}
