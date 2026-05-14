// @vitest-environment node
/**
 * Security integration tests — these hit the REAL database to verify:
 *
 *   1. Tenant isolation:       Org A's session cannot read Org B's resources.
 *   2. Permission enforcement: A user without a required slug gets 403.
 *   3. Audit log write:        A mutation creates an AuditLog row.
 *
 * The `next/headers` cookies() function is mocked so route handlers can be
 * called directly without a running HTTP server.
 *
 * Set SKIP_INTEGRATION_TESTS=1 to skip these if the test database is unavailable.
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'

// ── Mock next/headers BEFORE any imports that call cookies() ──────────────────
// getTenantSession() calls cookies() which needs the Next.js request scope.
// We mock it here to return whichever JWT the current test injects.
const mockCookieGet = vi.fn()

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: mockCookieGet,
    set: vi.fn(),
  }),
}))

// ── Mock email to prevent real SMTP calls ─────────────────────────────────────
vi.mock('@/lib/email', () => ({
  sendUserInvite: vi.fn().mockResolvedValue(undefined),
  sendPasswordReset: vi.fn().mockResolvedValue(undefined),
  sendOrganizationInvite: vi.fn().mockResolvedValue(undefined),
}))

// ── Mock rate-limit to be a no-op in tests ────────────────────────────────────
vi.mock('@/lib/rate-limit', () => ({
  checkLoginRateLimit: vi.fn().mockResolvedValue(null),
  checkPasswordResetRateLimit: vi.fn().mockResolvedValue(null),
}))

import { prisma } from '@/lib/prisma'
import { createTenantToken } from '@/lib/auth/session'
import bcrypt from 'bcryptjs'
import { BCRYPT_ROUNDS_PASSWORD } from '@/lib/constants'

// ── Skip guard ────────────────────────────────────────────────────────────────
const SKIP = process.env.SKIP_INTEGRATION_TESTS === '1' || !process.env.DATABASE_URL

// ── Helpers ───────────────────────────────────────────────────────────────────

function injectSession(token: string) {
  mockCookieGet.mockReturnValue({ value: token })
}

function makeRequest(url: string, opts: RequestInit = {}): Request {
  return new Request(`http://localhost:3000${url}`, opts)
}

// ── Test fixtures ─────────────────────────────────────────────────────────────

type OrgShape = { id: string; slug: string; name: string; status: string; plan: string }
type RoleShape = { id: string; name: string; isSystem: boolean; permissions: string[] }
type UserShape = { id: string }

let orgA: OrgShape, orgB: OrgShape
let ownerRoleA: RoleShape, viewerRoleA: RoleShape
let ownerA: UserShape, viewerA: UserShape
let resourceUserInOrgB: UserShape
let ownerAToken: string, viewerAToken: string

async function cleanupTestData() {
  await prisma.auditLog.deleteMany({
    where: { organization: { slug: { in: ['test-org-a-sec', 'test-org-b-sec'] } } },
  })
  await prisma.user.deleteMany({
    where: { organization: { slug: { in: ['test-org-a-sec', 'test-org-b-sec'] } } },
  })
  await prisma.role.deleteMany({
    where: { organization: { slug: { in: ['test-org-a-sec', 'test-org-b-sec'] } } },
  })
  await prisma.organization.deleteMany({
    where: { slug: { in: ['test-org-a-sec', 'test-org-b-sec'] } },
  })
}

beforeAll(async () => {
  if (SKIP) return
  await cleanupTestData()

  const hash = await bcrypt.hash('Test@12345', BCRYPT_ROUNDS_PASSWORD)

  orgA = (await prisma.organization.create({
    data: {
      slug: 'test-org-a-sec',
      name: 'Test Org A',
      email: 'a@test.com',
      status: 'ACTIVE',
      plan: 'PRO',
    },
  })) as OrgShape
  orgB = (await prisma.organization.create({
    data: {
      slug: 'test-org-b-sec',
      name: 'Test Org B',
      email: 'b@test.com',
      status: 'ACTIVE',
      plan: 'PRO',
    },
  })) as OrgShape

  ownerRoleA = (await prisma.role.create({
    data: { organizationId: orgA.id, name: 'Owner', isSystem: true, permissions: ['*'] },
  })) as RoleShape
  viewerRoleA = (await prisma.role.create({
    data: {
      organizationId: orgA.id,
      name: 'Viewer',
      isSystem: true,
      permissions: ['users:read', 'organization:read'],
    },
  })) as RoleShape

  const ownerRoleB = await prisma.role.create({
    data: { organizationId: orgB.id, name: 'Owner', isSystem: true, permissions: ['*'] },
  })

  ownerA = (await prisma.user.create({
    data: {
      organizationId: orgA.id,
      roleId: ownerRoleA.id,
      email: 'owner@org-a.test',
      name: 'Owner A',
      passwordHash: hash,
    },
  })) as UserShape
  viewerA = (await prisma.user.create({
    data: {
      organizationId: orgA.id,
      roleId: viewerRoleA.id,
      email: 'viewer@org-a.test',
      name: 'Viewer A',
      passwordHash: hash,
    },
  })) as UserShape
  resourceUserInOrgB = (await prisma.user.create({
    data: {
      organizationId: orgB.id,
      roleId: ownerRoleB.id,
      email: 'owner@org-b.test',
      name: 'Owner B',
      passwordHash: hash,
    },
  })) as UserShape

  ownerAToken = await createTenantToken({
    type: 'tenant',
    userId: ownerA.id,
    organizationId: orgA.id,
    organization: { id: orgA.id, slug: orgA.slug, name: orgA.name, status: 'ACTIVE', plan: 'PRO' },
    role: { id: ownerRoleA.id, name: 'Owner', isSystem: true },
    permissions: ['*'],
    sessionToken: crypto.randomUUID(),
  })

  viewerAToken = await createTenantToken({
    type: 'tenant',
    userId: viewerA.id,
    organizationId: orgA.id,
    organization: { id: orgA.id, slug: orgA.slug, name: orgA.name, status: 'ACTIVE', plan: 'PRO' },
    role: { id: viewerRoleA.id, name: 'Viewer', isSystem: true },
    permissions: viewerRoleA.permissions,
    sessionToken: crypto.randomUUID(),
  })
})

afterAll(async () => {
  if (SKIP) return
  await cleanupTestData()
  await prisma.$disconnect()
})

// ── Test 1: Tenant Isolation ──────────────────────────────────────────────────

describe('Tenant Isolation', () => {
  it.skipIf(SKIP)(
    'Owner of Org A cannot read a user that belongs to Org B (returns 404)',
    async () => {
      const { GET } = await import('@/app/api/users/[id]/route')
      injectSession(ownerAToken)
      const req = makeRequest(`/api/users/${resourceUserInOrgB.id}`)
      const res = await GET(req, { params: Promise.resolve({ id: resourceUserInOrgB.id }) })
      // Must be 404 — organizationId scoping makes Org B's row invisible to Org A
      expect(res.status).toBe(404)
    }
  )

  it.skipIf(SKIP)('Owner of Org A list endpoint returns only Org A users', async () => {
    const { GET } = await import('@/app/api/users/route')
    injectSession(ownerAToken)
    const req = makeRequest('/api/users')
    const res = await GET(req)
    const body = await res.json()
    expect(res.status).toBe(200)
    const returnedIds = body.data.map((u: { id: string }) => u.id)
    // Org B's user must NOT appear in Org A's list
    expect(returnedIds).not.toContain(resourceUserInOrgB.id)
    // Org A's own users must appear
    expect(returnedIds).toContain(ownerA.id)
  })
})

// ── Test 2: Permission Enforcement ───────────────────────────────────────────

describe('Permission Enforcement', () => {
  it.skipIf(SKIP)('Viewer (no users:invite) receives 403 from POST /api/invite', async () => {
    const { POST } = await import('@/app/api/invite/route')
    injectSession(viewerAToken)
    const req = makeRequest('/api/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'new@test.com', roleId: ownerRoleA.id }),
    })
    const res = await POST(req)
    expect(res.status).toBe(403)
    const body = await res.json()
    // Response must identify which permission was required
    expect(body.required).toBe('users:invite')
  })

  it.skipIf(SKIP)('Viewer (no roles:create) receives 403 from POST /api/roles', async () => {
    const { POST } = await import('@/app/api/roles/route')
    injectSession(viewerAToken)
    const req = makeRequest('/api/roles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Hacker Role', permissions: [] }),
    })
    const res = await POST(req)
    expect(res.status).toBe(403)
  })

  it.skipIf(SKIP)('Owner (wildcard) can access users:read protected endpoint', async () => {
    const { GET } = await import('@/app/api/users/route')
    injectSession(ownerAToken)
    const req = makeRequest('/api/users')
    const res = await GET(req)
    expect(res.status).toBe(200)
  })
})

// ── Test 3: Audit Log Written on Mutation ─────────────────────────────────────

describe('Audit Log', () => {
  it.skipIf(SKIP)(
    'Updating a user writes an AuditLog entry with correct entityId, action, and actor',
    async () => {
      const { PATCH } = await import('@/app/api/users/[id]/route')

      await prisma.auditLog.deleteMany({ where: { entity: 'User', entityId: viewerA.id } })

      injectSession(ownerAToken)
      const req = makeRequest(`/api/users/${viewerA.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Viewer A Updated' }),
      })

      const res = await PATCH(req, { params: Promise.resolve({ id: viewerA.id }) })
      expect(res.status).toBe(200)

      const log = await prisma.auditLog.findFirst({
        where: { entity: 'User', entityId: viewerA.id, action: 'UPDATE' },
        orderBy: { createdAt: 'desc' },
      })

      expect(log).not.toBeNull()
      expect(log!.organizationId).toBe(orgA.id)
      expect(log!.userId).toBe(ownerA.id) // actor is the authenticated user
      expect(log!.entity).toBe('User')
      expect(log!.entityId).toBe(viewerA.id) // subject of the change
      expect(log!.action).toBe('UPDATE')
      const newVal = log!.newValue as Record<string, unknown>
      expect(newVal.name).toBe('Viewer A Updated')
    }
  )
})
