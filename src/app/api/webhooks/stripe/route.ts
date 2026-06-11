import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { prisma } from '@/lib/prisma'
import { reconcilePlatformPayment, markPastDue } from '@/lib/billing/subscription'
import { saveCardPaymentMethod } from '@/lib/billing/payment-methods'
import { getPaymentProvider } from '@/lib/payments/providers/factory'
import { notifyAdmins } from '@/lib/notifications'

/**
 * Handles asynchronous follow-up for off-session PaymentIntents (3D Secure /
 * SCA challenges) and SetupIntents. Synchronous charges already resolve
 * inside StripeProvider.charge — this endpoint reconciles the PENDING
 * PlatformPayment rows that result when Stripe needs more time.
 */
export async function POST(req: NextRequest) {
  const signature = req.headers.get('stripe-signature')
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  const apiKey = process.env.STRIPE_SECRET_KEY

  if (!signature || !webhookSecret || !apiKey || apiKey.includes('xxxx')) {
    return NextResponse.json({ error: 'Stripe is not configured.' }, { status: 503 })
  }

  const payload = await req.text()
  const stripe = new Stripe(apiKey)

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret)
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  switch (event.type) {
    case 'payment_intent.succeeded':
      await handlePaymentIntentResolved(event.data.object as Stripe.PaymentIntent, true)
      break
    case 'payment_intent.payment_failed':
      await handlePaymentIntentResolved(event.data.object as Stripe.PaymentIntent, false)
      break
    case 'setup_intent.succeeded':
      await handleSetupIntentSucceeded(event.data.object as Stripe.SetupIntent)
      break
    default:
      break
  }

  return NextResponse.json({ received: true })
}

async function handlePaymentIntentResolved(intent: Stripe.PaymentIntent, succeeded: boolean) {
  const payment = await prisma.platformPayment.findFirst({
    where: { providerRef: intent.id, provider: 'STRIPE', status: 'PENDING' },
  })
  if (!payment) return

  const notes = succeeded ? undefined : (intent.last_payment_error?.message ?? 'Payment failed.')
  await reconcilePlatformPayment(payment.id, succeeded ? 'SUCCEEDED' : 'FAILED', notes)

  if (succeeded) return

  if (payment.type === 'SUBSCRIPTION') {
    const org = await prisma.organization.findUnique({
      where: { id: payment.organizationId },
      select: { status: true },
    })
    if (org?.status === 'ACTIVE') {
      await markPastDue(payment.organizationId)
    }
    await notifyAdmins({
      organizationId: payment.organizationId,
      type: 'billing_payment_failed',
      title: 'Subscription payment failed',
      body:
        notes ??
        'Your card was declined. Please update your payment method to avoid service interruption.',
      data: { actionUrl: '/admin/billing' },
    })
  } else if (payment.type === 'TOPUP' && payment.topUpOrderId) {
    const order = await prisma.tokenTopUpOrder.findUnique({ where: { id: payment.topUpOrderId } })
    if (order && order.status === 'PENDING') {
      await prisma.tokenTopUpOrder.update({
        where: { id: order.id },
        data: { status: 'FAILED', failedReason: notes },
      })
      await notifyAdmins({
        organizationId: payment.organizationId,
        type: 'billing_topup_failed',
        title: order.isAutoTopUp ? 'Auto top-up failed' : 'Token top-up failed',
        body: notes ?? 'Your payment could not be processed. Please update your payment method.',
        data: { actionUrl: '/admin/billing' },
      })
    }
  }
}

/**
 * Fallback save path for cards confirmed via a redirect-based 3DS challenge,
 * where the client may never return to call POST /billing/payment-methods.
 */
async function handleSetupIntentSucceeded(intent: Stripe.SetupIntent) {
  const customerId = typeof intent.customer === 'string' ? intent.customer : intent.customer?.id
  const paymentMethodId =
    typeof intent.payment_method === 'string' ? intent.payment_method : intent.payment_method?.id
  if (!customerId || !paymentMethodId) return

  const org = await prisma.organization.findFirst({ where: { stripeCustomerId: customerId } })
  if (!org) return

  const existing = await prisma.billingPaymentMethod.findFirst({
    where: { organizationId: org.id, providerPaymentMethodId: paymentMethodId },
  })
  if (existing) return

  const provider = getPaymentProvider('STRIPE')
  const methods = await provider.listPaymentMethods(customerId)
  const method = methods.find((m) => m.id === paymentMethodId)
  if (!method) return

  await saveCardPaymentMethod({
    organizationId: org.id,
    providerPaymentMethodId: paymentMethodId,
    brand: method.brand,
    last4: method.last4,
    expMonth: method.expMonth,
    expYear: method.expYear,
  })
}
