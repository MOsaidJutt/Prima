import type { Organization, User, Role, Department, SuperAdmin } from '@prisma/client'

// ── Super Admin session (platform-level, unchanged from Phase 0) ──────────────

export type SuperAdminSession = {
  type: 'super_admin'
  superAdmin: Pick<SuperAdmin, 'id' | 'email' | 'name' | 'role' | 'permissions'>
  sessionToken: string
}

// ── Tenant session (JWT payload in prima_session cookie) ──────────────────────
// Phase 1c additions: role + permissions embedded for client-side gating.
// Server API routes always re-check DB (ground truth). If userId resolves to
// no User row (Phase 0 legacy session where userId === organizationId), the
// DB check returns null → 401 → user must re-login. No explicit invalidation.

export type TenantSession = {
  type: 'tenant'
  userId: string
  organizationId: string
  organization: Pick<Organization, 'id' | 'slug' | 'name' | 'status' | 'plan'>
  role: { id: string; name: string; isSystem: boolean }
  permissions: string[]
  sessionToken: string
}

export type AppSession = SuperAdminSession | TenantSession

// ── Enriched user with relations (returned by requireTenantAuth) ─────────────

export type UserWithRole = User & { role: Role; department: Department | null }

// ── Generic API response envelopes ───────────────────────────────────────────

export type ApiResponse<T = unknown> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string }

export type PaginatedResponse<T> = {
  data: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}
