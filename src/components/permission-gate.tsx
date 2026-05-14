'use client'

import { useContext } from 'react'
import { UserContext } from '@/context/user-context'
import { hasPermission, hasAnyPermission } from '@/lib/permissions'
import type { PermissionSlug } from '@/lib/permissions'

// ── <PermissionGate> ──────────────────────────────────────────────────────────
// Renders children only when the authenticated user holds the given slug.
// UX guard only — API routes enforce permissions server-side (ground truth).

interface PermissionGateProps {
  slug: PermissionSlug
  children: React.ReactNode
  fallback?: React.ReactNode
}

export function PermissionGate({ slug, children, fallback = null }: PermissionGateProps) {
  const ctx = useContext(UserContext)
  const allowed = ctx ? hasPermission(ctx.permissions, slug) : false
  return <>{allowed ? children : fallback}</>
}

// ── <AnyPermissionGate> ───────────────────────────────────────────────────────

interface AnyPermissionGateProps {
  slugs: PermissionSlug[]
  children: React.ReactNode
  fallback?: React.ReactNode
}

export function AnyPermissionGate({ slugs, children, fallback = null }: AnyPermissionGateProps) {
  const ctx = useContext(UserContext)
  const allowed = ctx ? hasAnyPermission(ctx.permissions, slugs) : false
  return <>{allowed ? children : fallback}</>
}
