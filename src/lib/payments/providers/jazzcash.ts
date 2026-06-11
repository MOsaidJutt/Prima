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
 * JazzCash mobile wallet — stub provider.
 *
 * JazzCash's Mobile Account / Mobile Wallet API requires a signed merchant
 * agreement (merchant ID, integrity salt, hashed-request flow against their
 * sandbox/production endpoints). That credential exchange can't happen in
 * this codebase, so this provider reports itself as unconfigured. The
 * factory falls back to ManualPaymentProvider for orgs that select JazzCash
 * until real merchant credentials are wired in.
 */
export class JazzCashProvider implements IPaymentProvider {
  readonly type: PaymentProviderType = 'JAZZCASH'

  isConfigured(): boolean {
    return false
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
    throw new Error('JazzCash integration is not yet configured.')
  }

  async listPaymentMethods(): Promise<SavedPaymentMethod[]> {
    return []
  }

  async removePaymentMethod(): Promise<void> {
    // no-op
  }

  async charge(_params: ChargeParams): Promise<ChargeResult> {
    return { status: 'FAILED', error: 'JazzCash integration is not yet configured.' }
  }
}
