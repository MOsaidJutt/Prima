import type { PaymentProviderType } from '@prisma/client'
import type {
  ChargeParams,
  ChargeResult,
  IPaymentProvider,
  PaymentCustomer,
  SavedPaymentMethod,
  SetupIntentResult,
} from './interface'

/**
 * Manual provider — no real payment gateway involved. Used for bank
 * transfers / cash deposits / cheques that a Super Admin reconciles by hand
 * via the org billing page. Charges are recorded as PENDING and a Super
 * Admin marks them SUCCEEDED or FAILED once the funds are confirmed.
 */
export class ManualPaymentProvider implements IPaymentProvider {
  readonly type: PaymentProviderType = 'MANUAL'

  isConfigured(): boolean {
    return true
  }

  async ensureCustomer(params: {
    organizationId: string
    email: string
    name: string
    existingCustomerId?: string | null
  }): Promise<PaymentCustomer> {
    return { customerId: params.existingCustomerId ?? params.organizationId }
  }

  async createSetupIntent(): Promise<SetupIntentResult> {
    throw new Error('Manual payment provider does not support saved payment methods.')
  }

  async listPaymentMethods(): Promise<SavedPaymentMethod[]> {
    return []
  }

  async removePaymentMethod(): Promise<void> {
    // no-op: manual provider has no provider-side payment methods
  }

  async charge(_params: ChargeParams): Promise<ChargeResult> {
    return { status: 'PENDING' }
  }
}
