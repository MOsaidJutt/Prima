import type { PaymentProviderType } from '@prisma/client'
import { ManualPaymentProvider } from './manual'
import { StripeProvider } from './stripe'
import { JazzCashProvider } from './jazzcash'
import { EasyPaisaProvider } from './easypaisa'
import type { IPaymentProvider } from './interface'

/**
 * Returns the payment provider for the given type. Falls back to
 * ManualPaymentProvider for providers that report themselves as
 * unconfigured (e.g. Stripe with no API key, or the JazzCash/EasyPaisa
 * stubs), so charges are recorded as PENDING for manual reconciliation
 * instead of failing outright.
 */
export function getPaymentProvider(type: PaymentProviderType): IPaymentProvider {
  const provider = buildProvider(type)
  if (!provider.isConfigured() && provider.type !== 'MANUAL') {
    return new ManualPaymentProvider()
  }
  return provider
}

function buildProvider(type: PaymentProviderType): IPaymentProvider {
  switch (type) {
    case 'MANUAL':
      return new ManualPaymentProvider()
    case 'STRIPE':
      return new StripeProvider()
    case 'JAZZCASH':
      return new JazzCashProvider()
    case 'EASYPAISA':
      return new EasyPaisaProvider()
    default:
      throw new Error(`Unknown payment provider: ${type}`)
  }
}
