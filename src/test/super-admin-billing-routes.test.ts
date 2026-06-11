// @vitest-environment node
/**
 * Unit tests for the super-admin billing CRUD routes (coupons + promotions):
 * authentication, OWNER-only enforcement, zod validation, duplicate-code
 * rejection, and platform audit logging. Session and Prisma are mocked;
 * requireOwner runs for real.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGetSession = vi.fn()
vi.mock('@/lib/auth/session', () => ({
  getSuperAdminSession: (...args: unknown[]) => mockGetSession(...args),
}))

const mockCouponFindUnique = vi.fn()
const mockCouponFindMany = vi.fn()
const mockCouponCount = vi.fn()
const mockCouponCreate = vi.fn()
const mockCouponUpdate = vi.fn()
const mockPromotionCreate = vi.fn()
const mockAuditCreate = vi.fn()

vi.mock('@/lib/prisma', () => ({
  prisma: {
    coupon: {
      findUnique: (...args: unknown[]) => mockCouponFindUnique(...args),
      findMany: (...args: unknown[]) => mockCouponFindMany(...args),
      count: (...args: unknown[]) => mockCouponCount(...args),
      create: (...args: unknown[]) => mockCouponCreate(...args),
      update: (...args: unknown[]) => mockCouponUpdate(...args),
    },
    promotion: {
      create: (...args: unknown[]) => mockPromotionCreate(...args),
    },
    platformAuditLog: {
      create: (...args: unknown[]) => mockAuditCreate(...args),
    },
  },
}))

import { GET as couponsGet, POST as couponsPost } from '@/app/api/super-admin/billing/coupons/route'
import { DELETE as couponDelete } from '@/app/api/super-admin/billing/coupons/[id]/route'
import { POST as promotionsPost } from '@/app/api/super-admin/billing/promotions/route'

const ownerSession = {
  superAdmin: { id: 'sa-1', email: 'owner@prima.app', role: 'OWNER', permissions: ['*'] },
}
const staffSession = {
  superAdmin: { id: 'sa-2', email: 'staff@prima.app', role: 'SUPPORT', permissions: [] },
}

function jsonRequest(url: string, body?: unknown): Request {
  return new Request(`http://localhost:3000${url}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockAuditCreate.mockResolvedValue({})
})

describe('GET /api/super-admin/billing/coupons', () => {
  it('returns 401 without a session', async () => {
    mockGetSession.mockResolvedValue(null)
    const res = await couponsGet(jsonRequest('/api/super-admin/billing/coupons'))
    expect(res.status).toBe(401)
  })

  it('returns a paginated coupon list', async () => {
    mockGetSession.mockResolvedValue(ownerSession)
    mockCouponFindMany.mockResolvedValue([{ id: 'c-1', code: 'LAUNCH20' }])
    mockCouponCount.mockResolvedValue(1)

    const res = await couponsGet(jsonRequest('/api/super-admin/billing/coupons?page=1'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data).toHaveLength(1)
    expect(body.total).toBe(1)
  })

  it('clamps an invalid page param instead of producing NaN offsets', async () => {
    mockGetSession.mockResolvedValue(ownerSession)
    mockCouponFindMany.mockResolvedValue([])
    mockCouponCount.mockResolvedValue(0)

    const res = await couponsGet(jsonRequest('/api/super-admin/billing/coupons?page=banana'))
    expect(res.status).toBe(200)
    expect(mockCouponFindMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 0 }))
  })
})

describe('POST /api/super-admin/billing/coupons', () => {
  const validBody = { code: 'NEWYEAR25', discountType: 'PERCENT', discountValue: 25 }

  it('returns 401 without a session', async () => {
    mockGetSession.mockResolvedValue(null)
    const res = await couponsPost(jsonRequest('/api/super-admin/billing/coupons', validBody))
    expect(res.status).toBe(401)
  })

  it('returns 403 for a non-OWNER super admin', async () => {
    mockGetSession.mockResolvedValue(staffSession)
    const res = await couponsPost(jsonRequest('/api/super-admin/billing/coupons', validBody))
    expect(res.status).toBe(403)
    expect(mockCouponCreate).not.toHaveBeenCalled()
  })

  it('rejects a duplicate code', async () => {
    mockGetSession.mockResolvedValue(ownerSession)
    mockCouponFindUnique.mockResolvedValue({ id: 'c-existing', code: 'NEWYEAR25' })

    const res = await couponsPost(jsonRequest('/api/super-admin/billing/coupons', validBody))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/already exists/)
  })

  it('rejects an invalid code via zod (400, not 500)', async () => {
    mockGetSession.mockResolvedValue(ownerSession)
    const res = await couponsPost(
      jsonRequest('/api/super-admin/billing/coupons', { code: 'has spaces!' })
    )
    expect(res.status).toBe(400)
  })

  it('creates the coupon uppercased and writes a platform audit log', async () => {
    mockGetSession.mockResolvedValue(ownerSession)
    mockCouponFindUnique.mockResolvedValue(null)
    mockCouponCreate.mockResolvedValue({
      id: 'c-new',
      code: 'NEWYEAR25',
      discountType: 'PERCENT',
      discountValue: 25,
    })

    const res = await couponsPost(
      jsonRequest('/api/super-admin/billing/coupons', { ...validBody, code: 'newyear25' })
    )

    expect(res.status).toBe(201)
    expect(mockCouponCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ code: 'NEWYEAR25' }),
    })
    expect(mockAuditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        superAdminId: 'sa-1',
        action: 'CREATE',
        entity: 'Coupon',
        entityId: 'c-new',
      }),
    })
  })
})

describe('DELETE /api/super-admin/billing/coupons/[id]', () => {
  const params = Promise.resolve({ id: 'c-1' })

  it('returns 403 for a non-OWNER super admin', async () => {
    mockGetSession.mockResolvedValue(staffSession)
    const res = await couponDelete(new Request('http://localhost:3000'), { params })
    expect(res.status).toBe(403)
  })

  it('returns 404 for an unknown coupon', async () => {
    mockGetSession.mockResolvedValue(ownerSession)
    mockCouponFindUnique.mockResolvedValue(null)
    const res = await couponDelete(new Request('http://localhost:3000'), { params })
    expect(res.status).toBe(404)
  })

  it('deactivates instead of hard-deleting, and audit-logs the change', async () => {
    mockGetSession.mockResolvedValue(ownerSession)
    mockCouponFindUnique.mockResolvedValue({ id: 'c-1', code: 'LAUNCH20', isActive: true })
    mockCouponUpdate.mockResolvedValue({ id: 'c-1', code: 'LAUNCH20', isActive: false })

    const res = await couponDelete(new Request('http://localhost:3000'), { params })

    expect(res.status).toBe(200)
    expect(mockCouponUpdate).toHaveBeenCalledWith({
      where: { id: 'c-1' },
      data: { isActive: false },
    })
    expect(mockAuditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: 'DELETE', entity: 'Coupon', entityId: 'c-1' }),
    })
  })
})

describe('POST /api/super-admin/billing/promotions', () => {
  it('returns 403 for a non-OWNER super admin', async () => {
    mockGetSession.mockResolvedValue(staffSession)
    const res = await promotionsPost(
      jsonRequest('/api/super-admin/billing/promotions', { name: 'Spring Sale' })
    )
    expect(res.status).toBe(403)
  })

  it('creates a promotion and audit-logs the full record', async () => {
    mockGetSession.mockResolvedValue(ownerSession)
    const promotion = {
      id: 'promo-1',
      name: 'Spring Sale',
      discountType: 'PERCENT',
      discountValue: 10,
      appliesTo: 'ALL',
      isActive: true,
    }
    mockPromotionCreate.mockResolvedValue(promotion)

    const res = await promotionsPost(
      jsonRequest('/api/super-admin/billing/promotions', {
        name: 'Spring Sale',
        discountType: 'PERCENT',
        discountValue: 10,
      })
    )

    expect(res.status).toBe(201)
    // GAP-18: newValue must capture the full created promotion, not a subset.
    expect(mockAuditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'CREATE',
        entity: 'Promotion',
        entityId: 'promo-1',
        newValue: expect.objectContaining({ name: 'Spring Sale', discountValue: 10 }),
      }),
    })
  })

  it('rejects a too-short name via zod', async () => {
    mockGetSession.mockResolvedValue(ownerSession)
    const res = await promotionsPost(
      jsonRequest('/api/super-admin/billing/promotions', { name: 'x' })
    )
    expect(res.status).toBe(400)
  })
})
