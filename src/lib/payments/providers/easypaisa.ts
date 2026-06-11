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
 * EasyPaisa mobile wallet — stub provider.
 *
 * Like JazzCash, EasyPaisa's Open API requires a merchant onboarding
 * agreement (store ID, hash key) that can't be obtained in this codebase.
 * This provider reports itself as unconfigured so the factory falls back to
 * ManualPaymentProvider until real merchant credentials are wired in.
 */
export class EasyPaisaProvider implements IPaymentProvider {
  readonly type: PaymentProviderType = 'EASYPAISA'

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
    throw new Error('EasyPaisa integration is not yet configured.')
  }

  async listPaymentMethods(): Promise<SavedPaymentMethod[]> {
    return []
  }

  async removePaymentMethod(): Promise<void> {
    // no-op
  }

  async charge(_params: ChargeParams): Promise<ChargeResult> {
    return { status: 'FAILED', error: 'EasyPaisa integration is not yet configured.' }
  }
}
