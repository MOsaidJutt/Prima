// @vitest-environment node
/**
 * Unit tests for the Stripe webhook route (src/app/api/webhooks/stripe) —
 * signature/config guards plus the async reconciliation flows for
 * payment_intent and setup_intent events. Stripe, Prisma, and the billing
 * libs are mocked.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { NextRequest } from 'next/server'

const { mockConstructEvent } = vi.hoisted(() => ({ mockConstructEvent: vi.fn() }))

vi.mock('stripe', () => ({
  default: class MockStripe {
    webhooks = { constructEvent: mockConstructEvent }
  },
}))

const mockPaymentFindFirst = vi.fn()
const mockOrgFindUnique = vi.fn()
const mockOrgFindFirst = vi.fn()
const mockOrderFindUnique = vi.fn()
const mockOrderUpdate = vi.fn()
const mockPmFindFirst = vi.fn()

vi.mock('@/lib/prisma', () => ({
  prisma: {
    platformPayment: {
      findFirst: (...args: unknown[]) => mockPaymentFindFirst(...args),
    },
    organization: {
      findUnique: (...args: unknown[]) => mockOrgFindUnique(...args),
      findFirst: (...args: unknown[]) => mockOrgFindFirst(...args),
    },
    tokenTopUpOrder: {
      findUnique: (...args: unknown[]) => mockOrderFindUnique(...args),
      update: (...args: unknown[]) => mockOrderUpdate(...args),
    },
    billingPaymentMethod: {
      findFirst: (...args: unknown[]) => mockPmFindFirst(...args),
    },
  },
}))

const mockReconcile = vi.fn()
const mockMarkPastDue = vi.fn()
vi.mock('@/lib/billing/subscription', () => ({
  reconcilePlatformPayment: (...args: unknown[]) => mockReconcile(...args),
  markPastDue: (...args: unknown[]) => mockMarkPastDue(...args),
}))

const mockSaveCard = vi.fn()
vi.mock('@/lib/billing/payment-methods', () => ({
  saveCardPaymentMethod: (...args: unknown[]) => mockSaveCard(...args),
}))

const mockListProviderMethods = vi.fn()
vi.mock('@/lib/payments/providers/factory', () => ({
  getPaymentProvider: () => ({
    listPaymentMethods: (...args: unknown[]) => mockListProviderMethods(...args),
  }),
}))

const mockNotifyAdmins = vi.fn()
vi.mock('@/lib/notifications', () => ({
  notifyAdmins: (...args: unknown[]) => mockNotifyAdmins(...args),
}))

import { POST } from '@/app/api/webhooks/stripe/route'

function makeRequest(signature?: string): NextRequest {
  return new Request('http://localhost:3000/api/webhooks/stripe', {
    method: 'POST',
    headers: signature ? { 'stripe-signature': signature } : undefined,
    body: '{}',
  }) as unknown as NextRequest
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test'
  process.env.STRIPE_SECRET_KEY = 'sk_test_real_key'
  mockReconcile.mockResolvedValue(undefined)
  mockMarkPastDue.mockResolvedValue(undefined)
  mockNotifyAdmins.mockResolvedValue(undefined)
})

describe('POST /api/webhooks/stripe — guards', () => {
  it('returns 503 when Stripe is not configured', async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET
    const res = await POST(makeRequest('sig'))
    expect(res.status).toBe(503)
  })

  it('returns 503 when the signature header is missing', async () => {
    const res = await POST(makeRequest())
    expect(res.status).toBe(503)
  })

  it('returns 400 on an invalid signature', async () => {
    mockConstructEvent.mockImplementation(() => {
      throw new Error('bad signature')
    })
    const res = await POST(makeRequest('bad-sig'))
    expect(res.status).toBe(400)
    expect(mockReconcile).not.toHaveBeenCalled()
  })

  it('acknowledges unhandled event types without side effects', async () => {
    mockConstructEvent.mockReturnValue({ type: 'customer.created', data: { object: {} } })
    const res = await POST(makeRequest('sig'))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ received: true })
    expect(mockReconcile).not.toHaveBeenCalled()
  })
})

describe('payment_intent.succeeded', () => {
  it('reconciles the matching PENDING payment as SUCCEEDED', async () => {
    mockConstructEvent.mockReturnValue({
      type: 'payment_intent.succeeded',
      data: { object: { id: 'pi_1' } },
    })
    mockPaymentFindFirst.mockResolvedValue({
      id: 'payment-1',
      type: 'SUBSCRIPTION',
      organizationId: 'org-1',
    })

    const res = await POST(makeRequest('sig'))

    expect(res.status).toBe(200)
    expect(mockPaymentFindFirst).toHaveBeenCalledWith({
      where: { providerRef: 'pi_1', provider: 'STRIPE', status: 'PENDING' },
    })
    expect(mockReconcile).toHaveBeenCalledWith('payment-1', 'SUCCEEDED', undefined)
    expect(mockMarkPastDue).not.toHaveBeenCalled()
  })

  it('ignores intents with no matching pending payment', async () => {
    mockConstructEvent.mockReturnValue({
      type: 'payment_intent.succeeded',
      data: { object: { id: 'pi_unknown' } },
    })
    mockPaymentFindFirst.mockResolvedValue(null)

    const res = await POST(makeRequest('sig'))
    expect(res.status).toBe(200)
    expect(mockReconcile).not.toHaveBeenCalled()
  })
})

describe('payment_intent.payment_failed', () => {
  it('marks an ACTIVE org PAST_DUE on a failed subscription renewal and notifies admins', async () => {
    mockConstructEvent.mockReturnValue({
      type: 'payment_intent.payment_failed',
      data: {
        object: { id: 'pi_2', last_payment_error: { message: 'Card declined' } },
      },
    })
    mockPaymentFindFirst.mockResolvedValue({
      id: 'payment-2',
      type: 'SUBSCRIPTION',
      organizationId: 'org-1',
    })
    mockOrgFindUnique.mockResolvedValue({ status: 'ACTIVE' })

    await POST(makeRequest('sig'))

    expect(mockReconcile).toHaveBeenCalledWith('payment-2', 'FAILED', 'Card declined')
    expect(mockMarkPastDue).toHaveBeenCalledWith('org-1')
    expect(mockNotifyAdmins).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: 'org-1', type: 'billing_payment_failed' })
    )
  })

  it('does not re-mark an org that is already PAST_DUE', async () => {
    mockConstructEvent.mockReturnValue({
      type: 'payment_intent.payment_failed',
      data: { object: { id: 'pi_2', last_payment_error: null } },
    })
    mockPaymentFindFirst.mockResolvedValue({
      id: 'payment-2',
      type: 'SUBSCRIPTION',
      organizationId: 'org-1',
    })
    mockOrgFindUnique.mockResolvedValue({ status: 'PAST_DUE' })

    await POST(makeRequest('sig'))
    expect(mockMarkPastDue).not.toHaveBeenCalled()
    expect(mockNotifyAdmins).toHaveBeenCalled()
  })

  it('fails the linked top-up order on a failed TOPUP payment', async () => {
    mockConstructEvent.mockReturnValue({
      type: 'payment_intent.payment_failed',
      data: { object: { id: 'pi_3', last_payment_error: { message: 'Insufficient funds' } } },
    })
    mockPaymentFindFirst.mockResolvedValue({
      id: 'payment-3',
      type: 'TOPUP',
      organizationId: 'org-1',
      topUpOrderId: 'order-1',
    })
    mockOrderFindUnique.mockResolvedValue({ id: 'order-1', status: 'PENDING', isAutoTopUp: false })

    await POST(makeRequest('sig'))

    expect(mockOrderUpdate).toHaveBeenCalledWith({
      where: { id: 'order-1' },
      data: { status: 'FAILED', failedReason: 'Insufficient funds' },
    })
    expect(mockNotifyAdmins).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'billing_topup_failed' })
    )
  })
})

describe('setup_intent.succeeded', () => {
  const intent = {
    id: 'seti_1',
    customer: 'cus_1',
    payment_method: 'pm_stripe_9',
  }

  beforeEach(() => {
    mockConstructEvent.mockReturnValue({ type: 'setup_intent.succeeded', data: { object: intent } })
    mockOrgFindFirst.mockResolvedValue({ id: 'org-1', stripeCustomerId: 'cus_1' })
    mockListProviderMethods.mockResolvedValue([
      { id: 'pm_stripe_9', brand: 'visa', last4: '4242', expMonth: 12, expYear: 2030 },
    ])
  })

  it('saves the card when it is not already on file', async () => {
    mockPmFindFirst.mockResolvedValue(null)
    await POST(makeRequest('sig'))

    expect(mockSaveCard).toHaveBeenCalledWith({
      organizationId: 'org-1',
      providerPaymentMethodId: 'pm_stripe_9',
      brand: 'visa',
      last4: '4242',
      expMonth: 12,
      expYear: 2030,
    })
  })

  it('skips saving when the card already exists', async () => {
    mockPmFindFirst.mockResolvedValue({ id: 'pm-existing' })
    await POST(makeRequest('sig'))
    expect(mockSaveCard).not.toHaveBeenCalled()
  })

  it('ignores intents for unknown customers', async () => {
    mockOrgFindFirst.mockResolvedValue(null)
    await POST(makeRequest('sig'))
    expect(mockSaveCard).not.toHaveBeenCalled()
  })
})
