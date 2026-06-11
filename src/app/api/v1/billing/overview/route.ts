import { NextRequest } from 'next/server'
import { withTenantApi, apiOk } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'

const DAY_MS = 24 * 60 * 60 * 1000

export async function GET(req: NextRequest) {
  return withTenantApi(
    req,
    'billing:read',
    async ({ ctx }) => {
      const org = await prisma.organization.findUniqueOrThrow({
        where: { id: ctx.organizationId },
        select: {
          id: true,
          name: true,
          status: true,
          plan: true,
          billingCycle: true,
          monthlyPrice: true,
          customPricing: true,
          setupFeePaid: true,
          trialEndsAt: true,
          subscriptionStart: true,
          subscriptionEnd: true,
          nextBillingDate: true,
          pastDueAt: true,
          suspendedAt: true,
          cancelledAt: true,
          gracePeriodEndsAt: true,
          aiEnabled: true,
          monthlyTokenBudget: true,
          monthlyTokensUsed: true,
          autoTopUpEnabled: true,
          autoTopUpThreshold: true,
          autoTopUpPackId: true,
          billingEmail: true,
          billingName: true,
          billingPhone: true,
        },
      })

      const [billingPlan, wallet, defaultPaymentMethod] = await Promise.all([
        prisma.billingPlan.findUnique({ where: { tier: org.plan } }),
        prisma.tokenWallet.findUnique({ where: { organizationId: ctx.organizationId } }),
        prisma.billingPaymentMethod.findFirst({
          where: { organizationId: ctx.organizationId, isDefault: true, deletedAt: null },
        }),
      ])

      const trialDaysLeft = org.trialEndsAt
        ? Math.ceil((org.trialEndsAt.getTime() - Date.now()) / DAY_MS)
        : null

      return apiOk({
        organization: org,
        plan: billingPlan,
        wallet,
        defaultPaymentMethod,
        trial: {
          isTrialing: org.status === 'TRIAL',
          daysLeft: trialDaysLeft,
        },
      })
    },
    { bypassSubscriptionCheck: true }
  )
}
