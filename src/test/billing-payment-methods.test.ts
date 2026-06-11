// @vitest-environment node
/**
 * Unit tests for src/lib/billing/payment-methods.ts — most importantly the
 * soft-delete behavior of removePaymentMethod (BLOCKER-1): payment method
 * rows must NEVER be hard-deleted because PlatformPayment history references
 * them. Prisma and the payment provider factory are mocked.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockPmFindFirst = vi.fn()
const mockPmFindMany = vi.fn()
const mockPmUpdate = vi.fn()
const mockPmUpdateMany = vi.fn()
const mockPmCreate = vi.fn()
const mockPmCount = vi.fn()
const mockPmDelete = vi.fn()
const mockOrgFindUniqueOrThrow = vi.fn()
const mockOrgUpdate = vi.fn()

vi.mock('@/lib/prisma', () => ({
  prisma: {
    billingPaymentMethod: {
      findFirst: (...args: unknown[]) => mockPmFindFirst(...args),
      findMany: (...args: unknown[]) => mockPmFindMany(...args),
      update: (...args: unknown[]) => mockPmUpdate(...args),
      updateMany: (...args: unknown[]) => mockPmUpdateMany(...args),
      create: (...args: unknown[]) => mockPmCreate(...args),
      count: (...args: unknown[]) => mockPmCount(...args),
      delete: (...args: unknown[]) => mockPmDelete(...args),
    },
    organization: {
      findUniqueOrThrow: (...args: unknown[]) => mockOrgFindUniqueOrThrow(...args),
      update: (...args: unknown[]) => mockOrgUpdate(...args),
    },
  },
}))

const mockProviderRemove = vi.fn()
const mockEnsureCustomer = vi.fn()

vi.mock('@/lib/payments/providers/factory', () => ({
  getPaymentProvider: () => ({
    ensureCustomer: (...args: unknown[]) => mockEnsureCustomer(...args),
    removePaymentMethod: (...args: unknown[]) => mockProviderRemove(...args),
  }),
}))

import {
  listPaymentMethods,
  saveCardPaymentMethod,
  removePaymentMethod,
  getDefaultPaymentMethod,
} from '@/lib/billing/payment-methods'

function makeMethod(overrides: Record<string, unknown> = {}) {
  return {
    id: 'pm-1',
    organizationId: 'org-1',
    provider: 'STRIPE',
    providerPaymentMethodId: 'pm_stripe_1',
    isDefault: false,
    deletedAt: null,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockProviderRemove.mockResolvedValue(undefined)
  mockEnsureCustomer.mockResolvedValue({ customerId: 'cus_1' })
  mockOrgFindUniqueOrThrow.mockResolvedValue({
    id: 'org-1',
    email: 'org@test.dev',
    name: 'Test Org',
    stripeCustomerId: 'cus_1',
    billingEmail: null,
  })
})

describe('listPaymentMethods', () => {
  it('excludes soft-deleted methods', async () => {
    mockPmFindMany.mockResolvedValue([])
    await listPaymentMethods('org-1')
    expect(mockPmFindMany).toHaveBeenCalledWith({
      where: { organizationId: 'org-1', deletedAt: null },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    })
  })
})

describe('getDefaultPaymentMethod', () => {
  it('only considers live default methods', async () => {
    mockPmFindFirst.mockResolvedValue(null)
    await getDefaultPaymentMethod('org-1')
    expect(mockPmFindFirst).toHaveBeenCalledWith({
      where: { organizationId: 'org-1', isDefault: true, deletedAt: null },
    })
  })
})

describe('removePaymentMethod (BLOCKER-1: soft delete)', () => {
  it('throws when the method does not exist or is already deleted', async () => {
    mockPmFindFirst.mockResolvedValue(null)
    await expect(removePaymentMethod('org-1', 'pm-x')).rejects.toThrow('Payment method not found.')
  })

  it('soft-deletes via update — never calls prisma delete', async () => {
    mockPmFindFirst.mockResolvedValueOnce(makeMethod())
    await removePaymentMethod('org-1', 'pm-1')

    expect(mockPmDelete).not.toHaveBeenCalled()
    expect(mockPmUpdate).toHaveBeenCalledWith({
      where: { id: 'pm-1' },
      data: { deletedAt: expect.any(Date), isDefault: false },
    })
  })

  it('detaches the method at the provider before soft-deleting', async () => {
    mockPmFindFirst.mockResolvedValueOnce(makeMethod())
    await removePaymentMethod('org-1', 'pm-1')
    expect(mockProviderRemove).toHaveBeenCalledWith('pm_stripe_1')
  })

  it('still soft-deletes locally when the provider detach fails', async () => {
    mockPmFindFirst.mockResolvedValueOnce(makeMethod())
    mockProviderRemove.mockRejectedValueOnce(new Error('stripe down'))

    await expect(removePaymentMethod('org-1', 'pm-1')).resolves.toBeUndefined()
    expect(mockPmUpdate).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'pm-1' } }))
  })

  it('promotes the most recent live method to default when the default is removed', async () => {
    mockPmFindFirst
      .mockResolvedValueOnce(makeMethod({ isDefault: true }))
      .mockResolvedValueOnce(makeMethod({ id: 'pm-2', providerPaymentMethodId: 'pm_stripe_2' }))

    await removePaymentMethod('org-1', 'pm-1')

    // The replacement lookup must also skip soft-deleted rows.
    expect(mockPmFindFirst).toHaveBeenLastCalledWith({
      where: { organizationId: 'org-1', deletedAt: null },
      orderBy: { createdAt: 'desc' },
    })
    expect(mockPmUpdate).toHaveBeenCalledWith({
      where: { id: 'pm-2' },
      data: { isDefault: true },
    })
  })

  it('does not promote anything when a non-default method is removed', async () => {
    mockPmFindFirst.mockResolvedValueOnce(makeMethod({ isDefault: false }))
    await removePaymentMethod('org-1', 'pm-1')

    expect(mockPmFindFirst).toHaveBeenCalledTimes(1)
    expect(mockPmUpdate).toHaveBeenCalledTimes(1)
  })
})

describe('saveCardPaymentMethod', () => {
  it('makes the first saved card the default automatically', async () => {
    mockPmCount.mockResolvedValue(0)
    mockPmCreate.mockResolvedValue(makeMethod({ isDefault: true }))

    await saveCardPaymentMethod({
      organizationId: 'org-1',
      providerPaymentMethodId: 'pm_stripe_1',
      brand: 'visa',
      last4: '4242',
      expMonth: 12,
      expYear: 2030,
    })

    expect(mockPmCount).toHaveBeenCalledWith({
      where: { organizationId: 'org-1', deletedAt: null },
    })
    expect(mockPmCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ isDefault: true, providerPaymentMethodId: 'pm_stripe_1' }),
    })
  })

  it('clears the previous default when makeDefault is requested', async () => {
    mockPmCreate.mockResolvedValue(makeMethod())

    await saveCardPaymentMethod({
      organizationId: 'org-1',
      providerPaymentMethodId: 'pm_stripe_2',
      brand: 'visa',
      last4: '4242',
      expMonth: 12,
      expYear: 2030,
      makeDefault: true,
    })

    expect(mockPmUpdateMany).toHaveBeenCalledWith({
      where: { organizationId: 'org-1', isDefault: true, deletedAt: null },
      data: { isDefault: false },
    })
  })

  it('does not touch existing defaults when makeDefault is false and cards exist', async () => {
    mockPmCreate.mockResolvedValue(makeMethod())

    await saveCardPaymentMethod({
      organizationId: 'org-1',
      providerPaymentMethodId: 'pm_stripe_3',
      brand: 'visa',
      last4: '4242',
      expMonth: 12,
      expYear: 2030,
      makeDefault: false,
    })

    expect(mockPmUpdateMany).not.toHaveBeenCalled()
    expect(mockPmCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ isDefault: false }),
    })
  })
})
