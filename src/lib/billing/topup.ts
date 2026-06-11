import { prisma } from '@/lib/prisma'
import { getPaymentProvider } from '@/lib/payments/providers/factory'
import { getDefaultPaymentMethod } from './payment-methods'
import { notifyAdmins } from '@/lib/notifications'
import { createAuditLog } from '@/lib/audit'
import { DEFAULT_AUTO_TOPUP_PACK_NAME } from './constants'
import type { TokenTopUpOrder } from '@prisma/client'

export class TopUpError extends Error {}

/**
 * Purchase a token top-up pack. Charges the org's default saved payment
 * method (if any). Manual-provider orgs (or orgs with no saved card) are
 * recorded as PENDING for a Super Admin to reconcile via the org billing
 * page.
 *
 * Note: TokenTopUpPack.priceUsd / TokenTopUpOrder.priceUsd are legacy field
 * names from Phase 5 — the values are actually PKR per
 * Prima_Pricing_Strategy.md. Kept as-is to avoid an unrelated rename.
 */
export async function purchaseTopUp(params: {
  organizationId: string
  packId: string
  isAutoTopUp?: boolean
  userId?: string | null
  req?: Request
}): Promise<TokenTopUpOrder> {
  const pack = await prisma.tokenTopUpPack.findUnique({ where: { id: params.packId } })
  if (!pack || !pack.isActive) throw new TopUpError('This top-up pack is not available.')

  const defaultMethod = await getDefaultPaymentMethod(params.organizationId)
  const providerType = defaultMethod?.provider ?? 'MANUAL'

  const order = await prisma.tokenTopUpOrder.create({
    data: {
      organizationId: params.organizationId,
      packId: pack.id,
      tokens: pack.tokens,
      priceUsd: pack.priceUsd,
      isAutoTopUp: params.isAutoTopUp ?? false,
      provider: providerType,
      status: 'PENDING',
    },
  })

  const provider = getPaymentProvider(providerType)
  const result = await provider.charge({
    amountPkr: Number(pack.priceUsd),
    description: `Token top-up: ${pack.name} (${pack.tokens.toLocaleString()} tokens)`,
    customerId: defaultMethod?.providerCustomerId,
    paymentMethodId: defaultMethod?.providerPaymentMethodId,
    metadata: { organizationId: params.organizationId, topUpOrderId: order.id },
  })

  if (result.status === 'SUCCEEDED') {
    await prisma.$transaction([
      prisma.tokenTopUpOrder.update({
        where: { id: order.id },
        data: { status: 'COMPLETED', providerRef: result.providerRef, completedAt: new Date() },
      }),
      prisma.tokenWallet.update({
        where: { organizationId: params.organizationId },
        data: {
          balance: { increment: pack.tokens },
          totalPurchased: { increment: pack.tokens },
        },
      }),
      prisma.platformPayment.create({
        data: {
          organizationId: params.organizationId,
          type: 'TOPUP',
          amount: pack.priceUsd,
          provider: providerType,
          providerRef: result.providerRef,
          status: 'SUCCEEDED',
          topUpOrderId: order.id,
        },
      }),
    ])

    await notifyAdmins({
      organizationId: params.organizationId,
      type: 'billing_topup_success',
      title: params.isAutoTopUp ? 'Auto top-up completed' : 'Token top-up completed',
      body: `${pack.tokens.toLocaleString()} tokens added to your wallet (${pack.name} pack).`,
      data: { actionUrl: '/admin/billing' },
    })

    await createAuditLog({
      organizationId: params.organizationId,
      userId: params.userId,
      action: 'CREATE',
      entity: 'TokenTopUpOrder',
      entityId: order.id,
      newValue: {
        pack: pack.name,
        tokens: pack.tokens,
        status: 'COMPLETED',
        isAutoTopUp: !!params.isAutoTopUp,
      },
      req: params.req,
    })

    return (await prisma.tokenTopUpOrder.findUniqueOrThrow({
      where: { id: order.id },
    })) as TokenTopUpOrder
  }

  if (result.status === 'PENDING') {
    await prisma.$transaction([
      prisma.platformPayment.create({
        data: {
          organizationId: params.organizationId,
          type: 'TOPUP',
          amount: pack.priceUsd,
          provider: providerType,
          providerRef: result.providerRef,
          status: 'PENDING',
          topUpOrderId: order.id,
        },
      }),
    ])

    await createAuditLog({
      organizationId: params.organizationId,
      userId: params.userId,
      action: 'CREATE',
      entity: 'TokenTopUpOrder',
      entityId: order.id,
      newValue: {
        pack: pack.name,
        tokens: pack.tokens,
        status: 'PENDING',
        isAutoTopUp: !!params.isAutoTopUp,
      },
      req: params.req,
    })

    return (await prisma.tokenTopUpOrder.findUniqueOrThrow({
      where: { id: order.id },
    })) as TokenTopUpOrder
  }

  // FAILED
  await prisma.$transaction([
    prisma.tokenTopUpOrder.update({
      where: { id: order.id },
      data: { status: 'FAILED', failedReason: result.error },
    }),
    prisma.platformPayment.create({
      data: {
        organizationId: params.organizationId,
        type: 'TOPUP',
        amount: pack.priceUsd,
        provider: providerType,
        status: 'FAILED',
        notes: result.error,
        topUpOrderId: order.id,
      },
    }),
  ])

  await notifyAdmins({
    organizationId: params.organizationId,
    type: 'billing_topup_failed',
    title: params.isAutoTopUp ? 'Auto top-up failed' : 'Token top-up failed',
    body: result.error ?? 'Your payment could not be processed. Please update your payment method.',
    data: { actionUrl: '/admin/billing' },
  })

  await createAuditLog({
    organizationId: params.organizationId,
    userId: params.userId,
    action: 'CREATE',
    entity: 'TokenTopUpOrder',
    entityId: order.id,
    newValue: {
      pack: pack.name,
      tokens: pack.tokens,
      status: 'FAILED',
      isAutoTopUp: !!params.isAutoTopUp,
    },
    req: params.req,
  })

  return (await prisma.tokenTopUpOrder.findUniqueOrThrow({
    where: { id: order.id },
  })) as TokenTopUpOrder
}

/**
 * Called whenever AI usage is checked. If auto-top-up is enabled and the
 * org's remaining plan allowance has crossed the configured threshold,
 * purchases the configured (or default "Standard") pack — unless an
 * auto-top-up was already triggered in the last 24 hours.
 */
export async function triggerAutoTopUpIfNeeded(organizationId: string): Promise<void> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      autoTopUpEnabled: true,
      autoTopUpPackId: true,
      autoTopUpThreshold: true,
      monthlyTokenBudget: true,
      monthlyTokensUsed: true,
    },
  })
  if (!org?.autoTopUpEnabled) return

  const remaining = org.monthlyTokenBudget - org.monthlyTokensUsed
  if (remaining > org.autoTopUpThreshold) return

  const recent = await prisma.tokenTopUpOrder.findFirst({
    where: {
      organizationId,
      isAutoTopUp: true,
      status: { in: ['PENDING', 'COMPLETED'] },
      createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
  })
  if (recent) return

  let packId = org.autoTopUpPackId
  if (!packId) {
    const defaultPack = await prisma.tokenTopUpPack.findFirst({
      where: { name: DEFAULT_AUTO_TOPUP_PACK_NAME, isActive: true },
    })
    packId = defaultPack?.id ?? null
  }
  if (!packId) return

  await purchaseTopUp({ organizationId, packId, isAutoTopUp: true }).catch((err) => {
    console.error('[auto-topup]', organizationId, err)
  })
}
