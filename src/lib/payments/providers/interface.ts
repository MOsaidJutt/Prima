import type { PaymentProviderType, PlatformPaymentStatus } from '@prisma/client'

export interface PaymentCustomer {
  customerId: string
}

export interface SavedPaymentMethod {
  id: string
  brand: string | null
  last4: string | null
  expMonth: number | null
  expYear: number | null
}

export interface SetupIntentResult {
  clientSecret: string
  setupIntentId: string
}

export interface ChargeParams {
  /** Amount in PKR (the platform's base currency). */
  amountPkr: number
  description: string
  customerId?: string | null
  paymentMethodId?: string | null
  metadata?: Record<string, string>
}

export interface ChargeResult {
  status: PlatformPaymentStatus
  providerRef?: string
  error?: string
}

/**
 * Abstraction over platform-level payment providers used for subscription
 * billing, setup fees, and token top-ups. Mirrors the IAIProvider pattern in
 * src/lib/ai/providers — each provider implements the same surface so the
 * billing core lib can stay provider-agnostic.
 */
export interface IPaymentProvider {
  readonly type: PaymentProviderType

  /** Whether this provider has the credentials it needs to operate. */
  isConfigured(): boolean

  /** Create or reuse a customer record on the provider's side. */
  ensureCustomer(params: {
    organizationId: string
    email: string
    name: string
    existingCustomerId?: string | null
  }): Promise<PaymentCustomer>

  /** Begin saving a card / payment method for future off-session charges. */
  createSetupIntent(customerId: string): Promise<SetupIntentResult>

  /** List payment methods saved against a customer. */
  listPaymentMethods(customerId: string): Promise<SavedPaymentMethod[]>

  /** Detach/remove a saved payment method. */
  removePaymentMethod(paymentMethodId: string): Promise<void>

  /**
   * Charge a customer (subscription renewal, setup fee, or token top-up).
   * For providers that cannot charge programmatically (e.g. Manual), this
   * returns a PENDING result for a human to reconcile.
   */
  charge(params: ChargeParams): Promise<ChargeResult>
}
