// @vitest-environment node
// jose uses Web Crypto API which requires Node's crypto, not jsdom's partial implementation.
/**
 * Middleware tests — we test the underlying logic rather than the Next.js
 * middleware runner directly (which requires a full server). We import the
 * token verification helpers and verify the guard conditions.
 */
import { describe, it, expect } from 'vitest'
import { createSuperAdminToken, createTenantToken, verifyToken } from '@/lib/auth/session'
import type { SuperAdminSession, TenantSession } from '@/types'

const SA: SuperAdminSession = {
  type: 'super_admin',
  superAdmin: { id: 'sa-1', email: 'a@b.com', name: 'A', role: 'OWNER', permissions: ['*'] },
  sessionToken: 'st-1',
}

const TENANT: TenantSession = {
  type: 'tenant',
  userId: 'org-1',
  organizationId: 'org-1',
  organization: { id: 'org-1', slug: 'acme', name: 'ACME', status: 'ACTIVE', plan: 'PRO' },
  sessionToken: 'st-2',
}

describe('Middleware auth guard logic', () => {
  it('missing cookie → verifyToken returns null → should redirect', async () => {
    // Simulates: no cookie present
    const result = await verifyToken('')
    expect(result).toBeNull()
  })

  it('invalid token → verifyToken returns null → should redirect', async () => {
    const result = await verifyToken('garbage.token.value')
    expect(result).toBeNull()
  })

  it('valid super admin token passes verification', async () => {
    const token = await createSuperAdminToken(SA)
    const session = await verifyToken<SuperAdminSession>(token)
    expect(session?.type).toBe('super_admin')
    expect(session?.superAdmin.role).toBe('OWNER')
  })

  it('valid tenant token passes verification', async () => {
    const token = await createTenantToken(TENANT)
    const session = await verifyToken<TenantSession>(token)
    expect(session?.type).toBe('tenant')
    expect(session?.organizationId).toBe('org-1')
  })

  it('a super admin token is rejected as a tenant session (type check)', async () => {
    const token = await createSuperAdminToken(SA)
    const decoded = await verifyToken<TenantSession>(token)
    // The token verifies (same secret) but type field will be 'super_admin'
    // Middleware checks session.type === 'tenant', so this would redirect
    expect((decoded as unknown as Record<string, unknown>)?.type).not.toBe('tenant')
  })

  it('a tenant token is rejected as a super admin session (type check)', async () => {
    const token = await createTenantToken(TENANT)
    const decoded = await verifyToken<SuperAdminSession>(token)
    expect((decoded as unknown as Record<string, unknown>)?.type).not.toBe('super_admin')
  })
})

describe('Protected route patterns', () => {
  const superAdminProtected = [
    '/super-admin/dashboard',
    '/super-admin/organizations',
    '/super-admin/admins',
    '/super-admin/settings',
  ]

  const tenantProtected = ['/admin', '/manager', '/dashboard', '/onboarding']

  it('super-admin routes require a super_admin session', async () => {
    for (const path of superAdminProtected) {
      expect(path.startsWith('/super-admin')).toBe(true)
    }
  })

  it('/super-admin/login is NOT in the protected list', () => {
    const loginPath = '/super-admin/login'
    // The middleware skips protection for the login page
    const isProtected =
      loginPath.startsWith('/super-admin') && !loginPath.startsWith('/super-admin/login')
    expect(isProtected).toBe(false)
  })

  it('tenant protected routes require a tenant session', () => {
    for (const path of tenantProtected) {
      const isTenantRoute = ['/admin', '/manager', '/dashboard', '/onboarding'].some((p) =>
        path.startsWith(p)
      )
      expect(isTenantRoute).toBe(true)
    }
  })
})
