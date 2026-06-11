import { prisma } from '@/lib/prisma'
import { getPaymentProvider } from '@/lib/payments/providers/factory'

/** Ensure the org has a provider-side customer record and return its id. */
export async function ensurePaymentCustomer(organizationId: string): Promise<{
  provider: 'STRIPE'
  customerId: string
}> {
  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: organizationId },
    select: { id: true, email: true, name: true, stripeCustomerId: true, billingEmail: true },
  })

  const provider = getPaymentProvider('STRIPE')
  const { customerId } = await provider.ensureCustomer({
    organizationId: org.id,
    email: org.billingEmail ?? org.email,
    name: org.name,
    existingCustomerId: org.stripeCustomerId,
  })

  if (customerId !== org.stripeCustomerId) {
    await prisma.organization.update({
      where: { id: organizationId },
      data: { stripeCustomerId: customerId },
    })
  }

  return { provider: 'STRIPE', customerId }
}

/** Create a Stripe SetupIntent so the tenant can save a card on file. */
export async function createCardSetupIntent(organizationId: string) {
  const { customerId } = await ensurePaymentCustomer(organizationId)
  const provider = getPaymentProvider('STRIPE')
  return provider.createSetupIntent(customerId)
}

export async function listPaymentMethods(organizationId: string) {
  return prisma.billingPaymentMethod.findMany({
    where: { organizationId, deletedAt: null },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
  })
}

export async function saveCardPaymentMethod(params: {
  organizationId: string
  providerPaymentMethodId: string
  brand: string | null
  last4: string | null
  expMonth: number | null
  expYear: number | null
  makeDefault?: boolean
}) {
  const { customerId } = await ensurePaymentCustomer(params.organizationId)

  const makeDefault =
    params.makeDefault ??
    (await prisma.billingPaymentMethod.count({
      where: { organizationId: params.organizationId, deletedAt: null },
    })) === 0

  if (makeDefault) {
    await prisma.billingPaymentMethod.updateMany({
      where: { organizationId: params.organizationId, isDefault: true, deletedAt: null },
      data: { isDefault: false },
    })
  }

  return prisma.billingPaymentMethod.create({
    data: {
      organizationId: params.organizationId,
      provider: 'STRIPE',
      providerCustomerId: customerId,
      providerPaymentMethodId: params.providerPaymentMethodId,
      brand: params.brand,
      last4: params.last4,
      expMonth: params.expMonth,
      expYear: params.expYear,
      isDefault: makeDefault,
    },
  })
}

export async function removePaymentMethod(organizationId: string, id: string) {
  const method = await prisma.billingPaymentMethod.findFirst({
    where: { id, organizationId, deletedAt: null },
  })
  if (!method) throw new Error('Payment method not found.')

  if (method.providerPaymentMethodId) {
    const provider = getPaymentProvider(method.provider)
    await provider.removePaymentMethod(method.providerPaymentMethodId).catch(() => {})
  }

  await prisma.billingPaymentMethod.update({
    where: { id },
    data: { deletedAt: new Date(), isDefault: false },
  })

  if (method.isDefault) {
    const next = await prisma.billingPaymentMethod.findFirst({
      where: { organizationId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    })
    if (next) {
      await prisma.billingPaymentMethod.update({
        where: { id: next.id },
        data: { isDefault: true },
      })
    }
  }
}

export async function getDefaultPaymentMethod(organizationId: string) {
  return prisma.billingPaymentMethod.findFirst({
    where: { organizationId, isDefault: true, deletedAt: null },
  })
}
