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

// ── Fresh (non-JWT) organization billing/lifecycle status ────────────────────
// Phase 6: requireTenantAuth fetches these fields on every request so
// withTenantApi can enforce the current subscription status — unlike
// session.organization (JWT-embedded), this can never be stale.

export type OrgBillingStatus = Pick<
  Organization,
  | 'id'
  | 'slug'
  | 'name'
  | 'status'
  | 'plan'
  | 'pastDueAt'
  | 'suspendedAt'
  | 'cancelledAt'
  | 'gracePeriodEndsAt'
>

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

// ── Phase 2 entity types ──────────────────────────────────────────────────────
// Shared between API route return values and client fetch handlers.
// Use these instead of inline type annotations to keep both sides in sync.

export type DistributorStatus = 'ACTIVE' | 'INACTIVE' | 'BLACKLISTED'
export type DistributorTier = 'GOLD' | 'SILVER' | 'BRONZE'
export type ClientStatus = 'ACTIVE' | 'INACTIVE' | 'PROSPECT' | 'CHURNED'
export type BusinessType =
  | 'RETAIL'
  | 'WHOLESALE'
  | 'DISTRIBUTOR'
  | 'MANUFACTURER'
  | 'SERVICE'
  | 'OTHER'
export type BusinessSize = 'SMALL' | 'MEDIUM' | 'LARGE' | 'ENTERPRISE'
export type ProductStatus = 'ACTIVE' | 'INACTIVE' | 'DISCONTINUED'
export type InventoryTxType =
  | 'PURCHASE'
  | 'SALE'
  | 'ADJUSTMENT_IN'
  | 'ADJUSTMENT_OUT'
  | 'TRANSFER_IN'
  | 'TRANSFER_OUT'
  | 'RETURN'
  | 'WRITE_OFF'
  | 'STOCK_TAKE'

export type DistributorRow = {
  id: string
  code: string
  companyName: string
  contactName: string | null
  email: string | null
  phone: string | null
  city: string | null
  status: DistributorStatus
  tier: DistributorTier
  currentBalance: number
  creditLimit: number
  rating: number
  createdAt: string
  _count: { clients: number }
}

export type ClientRow = {
  id: string
  code: string
  companyName: string
  contactName: string | null
  email: string | null
  phone: string | null
  city: string | null
  status: ClientStatus
  businessType: BusinessType | null
  totalLifetimeValue: number
  lastOrderDate: string | null
  paymentBehaviorScore: number | null
  paymentBehaviorLabel: string | null
  distributor: { id: string; companyName: string } | null
  assignedRep: { id: string; name: string } | null
}

export type ProductRow = {
  id: string
  sku: string
  name: string
  brand: string | null
  sellingPrice: number
  costPrice: number
  reorderLevel: number
  status: ProductStatus
  images: string[]
  totalStock: number
  isLowStock: boolean
  category: { id: string; name: string } | null
}

export type WarehouseRow = {
  id: string
  code: string
  name: string
  city: string | null
  isDefault: boolean
  isActive: boolean
  _count: { inventoryStock: number }
}

export type InventoryTransactionRow = {
  id: string
  type: InventoryTxType
  quantity: number
  reason: string | null
  createdAt: string
  product: { name: string; sku: string }
  fromWarehouse: { name: string } | null
  toWarehouse: { name: string } | null
  performedByUser: { name: string } | null
}
