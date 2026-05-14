import { describe, it, expect } from 'vitest'
import { isSuperAdminOwner, hasSuperAdminPermission, requireOwner } from '@/lib/auth/permissions'
import type { SuperAdminSession } from '@/types'

const ownerSession: SuperAdminSession = {
  type: 'super_admin',
  superAdmin: { id: '1', email: 'a@b.com', name: 'Owner', role: 'OWNER', permissions: ['*'] },
  sessionToken: 'tok',
}

const subAdminSession: SuperAdminSession = {
  type: 'super_admin',
  superAdmin: {
    id: '2',
    email: 'sub@b.com',
    name: 'Sub',
    role: 'SUB_ADMIN',
    permissions: ['organizations:read'],
  },
  sessionToken: 'tok2',
}

describe('isSuperAdminOwner', () => {
  it('returns true for OWNER', () => expect(isSuperAdminOwner(ownerSession)).toBe(true))
  it('returns false for SUB_ADMIN', () => expect(isSuperAdminOwner(subAdminSession)).toBe(false))
})

describe('hasSuperAdminPermission', () => {
  it('wildcard "*" grants any permission', () => {
    expect(hasSuperAdminPermission(ownerSession, 'organizations:create')).toBe(true)
    expect(hasSuperAdminPermission(ownerSession, 'anything:ever')).toBe(true)
  })
  it('sub-admin with specific permission', () => {
    expect(hasSuperAdminPermission(subAdminSession, 'organizations:read')).toBe(true)
    expect(hasSuperAdminPermission(subAdminSession, 'organizations:create')).toBe(false)
  })
})

describe('requireOwner (C-3)', () => {
  it('returns null for OWNER — caller may proceed', () => {
    expect(requireOwner(ownerSession)).toBeNull()
  })

  it('returns 403 response for SUB_ADMIN', async () => {
    const res = requireOwner(subAdminSession)
    expect(res).not.toBeNull()
    const body = await res!.json()
    expect(res!.status).toBe(403)
    expect(body.error).toMatch(/Owner/)
  })

  it('returns 401 response for null session', async () => {
    const res = requireOwner(null)
    expect(res).not.toBeNull()
    const body = await res!.json()
    expect(res!.status).toBe(401)
    expect(body.error).toBe('Unauthorized')
  })
})
