// @vitest-environment node
/**
 * Unit tests for src/lib/billing/coupons.ts — coupon validation rules,
 * discount math, and redemption recording. Prisma is fully mocked so these
 * run without a database.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockCouponFindUnique = vi.fn()
const mockCouponUpdate = vi.fn()
const mockRedemptionFindUnique = vi.fn()
const mockRedemptionCreate = vi.fn()
const mockWalletUpdate = vi.fn()
const mockTransaction = vi.fn()

vi.mock('@/lib/prisma', () => ({
  prisma: {
    coupon: {
      findUnique: (...args: unknown[]) => mockCouponFindUnique(...args),
      update: (...args: unknown[]) => mockCouponUpdate(...args),
    },
    couponRedemption: {
      findUnique: (...args: unknown[]) => mockRedemptionFindUnique(...args),
      create: (...args: unknown[]) => mockRedemptionCreate(...args),
    },
    tokenWallet: {
      update: (...args: unknown[]) => mockWalletUpdate(...args),
    },
    $transaction: (...args: unknown[]) => mockTransaction(...args),
  },
}))

import {
  findValidCoupon,
  applyDiscount,
  recordCouponRedemption,
  CouponError,
} from '@/lib/billing/coupons'

const DAY_MS = 24 * 60 * 60 * 1000

function makeCoupon(overrides: Record<string, unknown> = {}) {
  return {
    id: 'coupon-1',
    code: 'LAUNCH20',
    isActive: true,
    validFrom: new Date(Date.now() - DAY_MS),
    validUntil: null,
    maxRedemptions: null,
    redemptionCount: 0,
    applicablePlans: [],
    ...overrides,
  }
}

describe('findValidCoupon', () => {
  beforeEach(() => {
    mockCouponFindUnique.mockReset()
    mockRedemptionFindUnique.mockReset()
    mockRedemptionFindUnique.mockResolvedValue(null)
  })

  it('normalizes the code (trim + uppercase) before lookup', async () => {
    mockCouponFindUnique.mockResolvedValue(makeCoupon())
    await findValidCoupon('  launch20 ', 'org-1', 'PRO')
    expect(mockCouponFindUnique).toHaveBeenCalledWith({ where: { code: 'LAUNCH20' } })
  })

  it('rejects an unknown code', async () => {
    mockCouponFindUnique.mockResolvedValue(null)
    await expect(findValidCoupon('NOPE', 'org-1', 'PRO')).rejects.toThrow(CouponError)
  })

  it('rejects an inactive coupon', async () => {
    mockCouponFindUnique.mockResolvedValue(makeCoupon({ isActive: false }))
    await expect(findValidCoupon('LAUNCH20', 'org-1', 'PRO')).rejects.toThrow(
      'Invalid or inactive coupon code.'
    )
  })

  it('rejects a coupon whose validFrom is in the future', async () => {
    mockCouponFindUnique.mockResolvedValue(makeCoupon({ validFrom: new Date(Date.now() + DAY_MS) }))
    await expect(findValidCoupon('LAUNCH20', 'org-1', 'PRO')).rejects.toThrow(
      'This coupon is not yet active.'
    )
  })

  it('rejects an expired coupon', async () => {
    mockCouponFindUnique.mockResolvedValue(
      makeCoupon({ validUntil: new Date(Date.now() - DAY_MS) })
    )
    await expect(findValidCoupon('LAUNCH20', 'org-1', 'PRO')).rejects.toThrow(
      'This coupon has expired.'
    )
  })

  it('rejects a coupon at its redemption limit', async () => {
    mockCouponFindUnique.mockResolvedValue(makeCoupon({ maxRedemptions: 5, redemptionCount: 5 }))
    await expect(findValidCoupon('LAUNCH20', 'org-1', 'PRO')).rejects.toThrow(
      'This coupon has reached its redemption limit.'
    )
  })

  it('rejects a coupon restricted to other plans', async () => {
    mockCouponFindUnique.mockResolvedValue(makeCoupon({ applicablePlans: ['ENTERPRISE'] }))
    await expect(findValidCoupon('LAUNCH20', 'org-1', 'PRO')).rejects.toThrow(
      'This coupon does not apply to the selected plan.'
    )
  })

  it('rejects a coupon the org has already redeemed', async () => {
    mockCouponFindUnique.mockResolvedValue(makeCoupon())
    mockRedemptionFindUnique.mockResolvedValue({ id: 'redemption-1' })
    await expect(findValidCoupon('LAUNCH20', 'org-1', 'PRO')).rejects.toThrow(
      'This coupon has already been redeemed by your organization.'
    )
  })

  it('returns the coupon when all checks pass', async () => {
    const coupon = makeCoupon({ applicablePlans: ['PRO', 'BUSINESS'], maxRedemptions: 10 })
    mockCouponFindUnique.mockResolvedValue(coupon)
    await expect(findValidCoupon('LAUNCH20', 'org-1', 'PRO')).resolves.toBe(coupon)
  })
})

describe('applyDiscount', () => {
  it('returns the amount unchanged when there is no discount', () => {
    expect(applyDiscount(1000, null, null)).toBe(1000)
    expect(applyDiscount(1000, 'PERCENT', null)).toBe(1000)
  })

  it('applies a percentage discount', () => {
    expect(applyDiscount(1000, 'PERCENT', 25)).toBe(750)
    expect(applyDiscount(999, 'PERCENT', 10)).toBe(899.1)
  })

  it('applies a flat discount', () => {
    expect(applyDiscount(1000, 'FLAT', 200)).toBe(800)
  })

  it('never goes below zero on a flat discount', () => {
    expect(applyDiscount(100, 'FLAT', 500)).toBe(0)
  })
})

describe('recordCouponRedemption', () => {
  beforeEach(() => {
    mockTransaction.mockReset()
    mockRedemptionCreate.mockReset()
    mockCouponUpdate.mockReset()
    mockWalletUpdate.mockReset()
    mockTransaction.mockResolvedValue([])
  })

  it('creates the redemption and increments the coupon counter atomically', async () => {
    await recordCouponRedemption({
      couponId: 'coupon-1',
      organizationId: 'org-1',
      discountApplied: 500,
      bonusTokensGranted: 0,
      setupFeeWaived: false,
    })

    expect(mockTransaction).toHaveBeenCalledTimes(1)
    expect(mockRedemptionCreate).toHaveBeenCalledWith({
      data: {
        couponId: 'coupon-1',
        organizationId: 'org-1',
        discountApplied: 500,
        bonusTokensGranted: 0,
        setupFeeWaived: false,
      },
    })
    expect(mockCouponUpdate).toHaveBeenCalledWith({
      where: { id: 'coupon-1' },
      data: { redemptionCount: { increment: 1 } },
    })
    // No bonus tokens -> the wallet is untouched.
    expect(mockWalletUpdate).not.toHaveBeenCalled()
  })

  it('credits bonus tokens to the wallet when granted', async () => {
    await recordCouponRedemption({
      couponId: 'coupon-1',
      organizationId: 'org-1',
      discountApplied: 0,
      bonusTokensGranted: 50000,
      setupFeeWaived: true,
    })

    expect(mockWalletUpdate).toHaveBeenCalledWith({
      where: { organizationId: 'org-1' },
      data: {
        balance: { increment: 50000 },
        totalPurchased: { increment: 50000 },
      },
    })
  })
})
