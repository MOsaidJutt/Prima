// ── Permission slug registry ──────────────────────────────────────────────────
// Single source of truth. All slugs validated at Role write time.
// Slugs prefixed by module; *_own vs *_any disambiguate ownership scope.
// API handlers enforce *_own by checking record.userId === authenticatedUser.id
// in addition to the slug check — the slug check alone is not enough.

export const PERMISSION_SLUGS = [
  // users
  'users:read',
  'users:create',
  'users:update',
  'users:delete',
  'users:invite',
  'users:suspend',

  // roles
  'roles:read',
  'roles:create',
  'roles:update',
  'roles:delete',

  // departments
  'departments:read',
  'departments:create',
  'departments:update',
  'departments:delete',

  // organization
  'organization:read',
  'organization:update',

  // branding
  'branding:update',

  // audit log
  'audit_log:read',

  // distributors (Phase 2)
  'distributors:read',
  'distributors:create',
  'distributors:update',
  'distributors:delete',
  'distributors:export',

  // clients (Phase 2)
  'clients:read',
  'clients:create',
  'clients:update',
  'clients:delete',
  'clients:export',

  // products (Phase 2)
  'products:read',
  'products:create',
  'products:update',
  'products:delete',

  // inventory (Phase 2)
  'inventory:read',
  'inventory:adjust',
  'inventory:transfer',

  // DSR (Phase 3) — *_own requires ownership check in handler
  'dsr:read',
  'dsr:read_all',
  'dsr:create',
  'dsr:update_own',
  'dsr:delete_own',
  'dsr:update_any',
  'dsr:approve',
  'dsr:reject',

  // invoices (Phase 3)
  'invoices:read',
  'invoices:create',
  'invoices:update',
  'invoices:delete',
  'invoices:send',
  'invoices:record_payment',

  // targets (Phase 3)
  'targets:read',
  'targets:create',
  'targets:update',
  'targets:delete',

  // reports (Phase 4)
  'reports:read',

  // AI (Phase 5)
  'ai:use',
  'ai:configure',

  // billing (Phase 6)
  'billing:read',
  'billing:update',
] as const

export type PermissionSlug = (typeof PERMISSION_SLUGS)[number]

export function isValidSlug(slug: string): slug is PermissionSlug {
  return (PERMISSION_SLUGS as readonly string[]).includes(slug)
}

// ── Permission modules (for grouped UI rendering) ─────────────────────────────

export const PERMISSION_MODULES: Array<{
  label: string
  slugs: PermissionSlug[]
}> = [
  {
    label: 'Users',
    slugs: [
      'users:read',
      'users:create',
      'users:update',
      'users:delete',
      'users:invite',
      'users:suspend',
    ],
  },
  {
    label: 'Roles',
    slugs: ['roles:read', 'roles:create', 'roles:update', 'roles:delete'],
  },
  {
    label: 'Departments',
    slugs: ['departments:read', 'departments:create', 'departments:update', 'departments:delete'],
  },
  {
    label: 'Organization',
    slugs: ['organization:read', 'organization:update', 'branding:update', 'audit_log:read'],
  },
  {
    label: 'Distributors',
    slugs: [
      'distributors:read',
      'distributors:create',
      'distributors:update',
      'distributors:delete',
      'distributors:export',
    ],
  },
  {
    label: 'Clients',
    slugs: ['clients:read', 'clients:create', 'clients:update', 'clients:delete', 'clients:export'],
  },
  {
    label: 'Products',
    slugs: ['products:read', 'products:create', 'products:update', 'products:delete'],
  },
  {
    label: 'Inventory',
    slugs: ['inventory:read', 'inventory:adjust', 'inventory:transfer'],
  },
  {
    label: 'DSR',
    slugs: [
      'dsr:read',
      'dsr:read_all',
      'dsr:create',
      'dsr:update_own',
      'dsr:delete_own',
      'dsr:update_any',
      'dsr:approve',
      'dsr:reject',
    ],
  },
  {
    label: 'Invoices',
    slugs: [
      'invoices:read',
      'invoices:create',
      'invoices:update',
      'invoices:delete',
      'invoices:send',
      'invoices:record_payment',
    ],
  },
  {
    label: 'Targets',
    slugs: ['targets:read', 'targets:create', 'targets:update', 'targets:delete'],
  },
  {
    label: 'Reports',
    slugs: ['reports:read'],
  },
  {
    label: 'AI',
    slugs: ['ai:use', 'ai:configure'],
  },
  {
    label: 'Billing',
    slugs: ['billing:read', 'billing:update'],
  },
]

// ── Default system role definitions ──────────────────────────────────────────
// Seeded once per organization. isSystem = true prevents UI edit/delete.

export const DEFAULT_ROLES: Array<{
  name: string
  description: string
  isSystem: boolean
  permissions: PermissionSlug[]
}> = [
  {
    name: 'Owner',
    description: 'Full access to everything. Cannot be deleted.',
    isSystem: true,
    // Wildcard '*' — hasPermission() handles this by short-circuiting
    permissions: PERMISSION_SLUGS as unknown as PermissionSlug[],
  },
  {
    name: 'Manager',
    description: 'Manages team, approves DSRs, can send invoices.',
    isSystem: true,
    permissions: [
      'users:read',
      'users:create',
      'users:update',
      'users:invite',
      'departments:read',
      'organization:read',
      'dsr:read_all',
      'dsr:approve',
      'dsr:reject',
      'dsr:update_any',
      'invoices:read',
      'invoices:send',
      'clients:read',
      'clients:create',
      'clients:update',
      'distributors:read',
      'distributors:create',
      'distributors:update',
      'products:read',
      'inventory:read',
      'targets:read',
      'targets:create',
      'targets:update',
      'reports:read',
      'ai:use',
    ],
  },
  {
    name: 'Sales Rep',
    description: 'Submits DSRs, manages own clients.',
    isSystem: true,
    permissions: [
      'dsr:read',
      'dsr:create',
      'dsr:update_own',
      'dsr:delete_own',
      'clients:read',
      'clients:create',
      'clients:update',
      'distributors:read',
      'products:read',
      'inventory:read',
      'targets:read',
      'reports:read',
      'ai:use',
    ],
  },
  {
    name: 'Accountant',
    description: 'Full invoice and payment access, read-only elsewhere.',
    isSystem: true,
    permissions: [
      'invoices:read',
      'invoices:create',
      'invoices:update',
      'invoices:delete',
      'invoices:send',
      'invoices:record_payment',
      'clients:read',
      'distributors:read',
      'products:read',
      'targets:read',
      'reports:read',
      'billing:read',
      'organization:read',
      'ai:use',
    ],
  },
  {
    name: 'Viewer',
    description: 'Read-only access to most modules.',
    isSystem: true,
    permissions: [
      'users:read',
      'departments:read',
      'organization:read',
      'clients:read',
      'distributors:read',
      'products:read',
      'inventory:read',
      'dsr:read',
      'invoices:read',
      'targets:read',
      'reports:read',
    ],
  },
]

// ── Runtime helpers ───────────────────────────────────────────────────────────

export function hasPermission(permissions: string[], slug: PermissionSlug): boolean {
  if (permissions.includes('*')) return true
  return permissions.includes(slug)
}

export function hasAnyPermission(permissions: string[], slugs: PermissionSlug[]): boolean {
  return slugs.some((s) => hasPermission(permissions, s))
}
