'use client'

import { createContext, useContext } from 'react'
import type { TenantSession } from '@/types'
import { hasPermission as _hasPermission } from '@/lib/permissions'
import type { PermissionSlug } from '@/lib/permissions'

// ── Context shape ─────────────────────────────────────────────────────────────
// Populated by the server component in /admin/layout.tsx, consumed by client
// components for conditional rendering. API routes do NOT rely on this —
// they always re-check the database (ground truth).

export type UserContextValue = {
  userId: string
  organizationId: string
  name: string
  email: string
  avatar: string | null
  role: { id: string; name: string; isSystem: boolean }
  permissions: string[]
  preferences: Record<string, unknown>
}

export const UserContext = createContext<UserContextValue | null>(null)

export function UserProvider({
  children,
  value,
}: {
  children: React.ReactNode
  value: UserContextValue
}) {
  return <UserContext.Provider value={value}>{children}</UserContext.Provider>
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

export function useUser(): UserContextValue {
  const ctx = useContext(UserContext)
  if (!ctx) throw new Error('useUser must be inside UserProvider')
  return ctx
}

export function usePermission(slug: PermissionSlug): boolean {
  const ctx = useContext(UserContext)
  if (!ctx) return false
  return _hasPermission(ctx.permissions, slug)
}

export function useSession(): Pick<TenantSession, 'userId' | 'organizationId'> {
  const ctx = useContext(UserContext)
  if (!ctx) throw new Error('useSession must be inside UserProvider')
  return { userId: ctx.userId, organizationId: ctx.organizationId }
}
