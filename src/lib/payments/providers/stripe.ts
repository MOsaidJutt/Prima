import Stripe from 'stripe'
import type { PaymentProviderType } from '@prisma/client'
import { pkrToUsdCents } from '../constants'
import type {
  ChargeParams,
  ChargeResult,
  IPaymentProvider,
  PaymentCustomer,
  SavedPaymentMethod,
  SetupIntentResult,
} from './interface'

let client: Stripe | null = null

function getClient(): Stripe {
  if (client) return client
  const key = process.env.STRIPE_SECRET_KEY
  if (!key || key.includes('xxxx')) {
    throw new Error('STRIPE_SECRET_KEY is not configured.')
  }
  client = new Stripe(key)
  return client
}

export class StripeProvider implements IPaymentProvider {
  readonly type: PaymentProviderType = 'STRIPE'

  isConfigured(): boolean {
    const key = process.env.STRIPE_SECRET_KEY
    return !!key && !key.includes('xxxx')
  }

  async ensureCustomer(params: {
    organizationId: string
    email: string
    name: string
    existingCustomerId?: string | null
  }): Promise<PaymentCustomer> {
    const stripe = getClient()

    if (params.existingCustomerId) {
      return { customerId: params.existingCustomerId }
    }

    const customer = await stripe.customers.create({
      email: params.email,
      name: params.name,
      metadata: { organizationId: params.organizationId },
    })

    return { customerId: customer.id }
  }

  async createSetupIntent(customerId: string): Promise<SetupIntentResult> {
    const stripe = getClient()

    const intent = await stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ['card'],
      usage: 'off_session',
    })

    if (!intent.client_secret) throw new Error('Stripe did not return a client secret.')

    return { clientSecret: intent.client_secret, setupIntentId: intent.id }
  }

  async listPaymentMethods(customerId: string): Promise<SavedPaymentMethod[]> {
    const stripe = getClient()

    const methods = await stripe.paymentMethods.list({ customer: customerId, type: 'card' })

    return methods.data.map((m) => ({
      id: m.id,
      brand: m.card?.brand ?? null,
      last4: m.card?.last4 ?? null,
      expMonth: m.card?.exp_month ?? null,
      expYear: m.card?.exp_year ?? null,
    }))
  }

  async removePaymentMethod(paymentMethodId: string): Promise<void> {
    const stripe = getClient()
    await stripe.paymentMethods.detach(paymentMethodId)
  }

  async charge(params: ChargeParams): Promise<ChargeResult> {
    const stripe = getClient()

    if (!params.customerId || !params.paymentMethodId) {
      return { status: 'FAILED', error: 'No saved payment method on file.' }
    }

    try {
      const intent = await stripe.paymentIntents.create({
        amount: pkrToUsdCents(params.amountPkr),
        currency: 'usd',
        customer: params.customerId,
        payment_method: params.paymentMethodId,
        off_session: true,
        confirm: true,
        description: params.description,
        metadata: params.metadata,
      })

      if (intent.status === 'succeeded') {
        return { status: 'SUCCEEDED', providerRef: intent.id }
      }

      return { status: 'PENDING', providerRef: intent.id }
    } catch (err) {
      if (err instanceof Stripe.errors.StripeCardError) {
        return { status: 'FAILED', error: err.message, providerRef: err.payment_intent?.id }
      }
      return { status: 'FAILED', error: err instanceof Error ? err.message : 'Unknown error' }
    }
  }
}
