import { prisma } from '@/lib/prisma'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PLAN_TIER_ORDER } from '@/lib/billing/plans'
import { PlansGrid, type PlanDTO } from './plan-card'
import { CouponsManager, type CouponDTO } from './coupons-manager'
import { PromotionsManager, type PromotionDTO } from './promotions-manager'

export const metadata = { title: 'Billing Plans' }

const TIER_LABELS: Record<string, string> = {
  STARTER: 'Starter',
  PRO: 'Pro',
  BUSINESS: 'Business',
  ENTERPRISE: 'Enterprise',
}

export default async function PlansPage() {
  const [plans, coupons, promotions] = await Promise.all([
    prisma.billingPlan.findMany({ orderBy: { sortOrder: 'asc' } }),
    prisma.coupon.findMany({ orderBy: { createdAt: 'desc' }, take: 50 }),
    prisma.promotion.findMany({ orderBy: { createdAt: 'desc' }, take: 50 }),
  ])

  const planByTier = new Map(plans.map((p) => [p.tier, p]))

  const planDtos: PlanDTO[] = PLAN_TIER_ORDER.map((tier, index) => {
    const p = planByTier.get(tier)
    if (!p) {
      return {
        tier,
        name: TIER_LABELS[tier] ?? tier,
        description: null,
        monthlyPrice: 0,
        annualPrice: 0,
        setupFee: 20000,
        maxUsers: null,
        aiTokensIncluded: 0,
        aiEnabled: false,
        perUserQuotasEnabled: false,
        invoiceTemplateLimit: null,
        customDomain: false,
        prioritySupport: false,
        sla: null,
        features: [],
        isActive: true,
        sortOrder: index,
        configured: false,
      }
    }
    return {
      tier: p.tier,
      name: p.name,
      description: p.description,
      monthlyPrice: Number(p.monthlyPrice),
      annualPrice: Number(p.annualPrice),
      setupFee: Number(p.setupFee),
      maxUsers: p.maxUsers,
      aiTokensIncluded: p.aiTokensIncluded,
      aiEnabled: p.aiEnabled,
      perUserQuotasEnabled: p.perUserQuotasEnabled,
      invoiceTemplateLimit: p.invoiceTemplateLimit,
      customDomain: p.customDomain,
      prioritySupport: p.prioritySupport,
      sla: p.sla,
      features: Array.isArray(p.features) ? (p.features as string[]) : [],
      isActive: p.isActive,
      sortOrder: p.sortOrder,
      configured: true,
    }
  })

  const couponDtos: CouponDTO[] = coupons.map((c) => ({
    id: c.id,
    code: c.code,
    description: c.description,
    discountType: c.discountType,
    discountValue: c.discountValue !== null ? Number(c.discountValue) : null,
    setupFeeWaiver: c.setupFeeWaiver,
    bonusTokens: c.bonusTokens,
    applicablePlans: c.applicablePlans,
    maxRedemptions: c.maxRedemptions,
    redemptionCount: c.redemptionCount,
    validFrom: c.validFrom.toISOString(),
    validUntil: c.validUntil ? c.validUntil.toISOString() : null,
    isActive: c.isActive,
  }))

  const promotionDtos: PromotionDTO[] = promotions.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    discountType: p.discountType,
    discountValue: p.discountValue !== null ? Number(p.discountValue) : null,
    setupFeeWaiver: p.setupFeeWaiver,
    bonusTokens: p.bonusTokens,
    appliesTo: p.appliesTo,
    startsAt: p.startsAt ? p.startsAt.toISOString() : null,
    endsAt: p.endsAt ? p.endsAt.toISOString() : null,
    isActive: p.isActive,
  }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Billing Plans</h1>
        <p className="text-muted-foreground">
          Manage subscription tiers, coupons, and platform-wide promotions
        </p>
      </div>

      <Tabs defaultValue="plans">
        <TabsList>
          <TabsTrigger value="plans">Plans</TabsTrigger>
          <TabsTrigger value="coupons">Coupons</TabsTrigger>
          <TabsTrigger value="promotions">Promotions</TabsTrigger>
        </TabsList>

        <TabsContent value="plans" className="mt-4">
          <PlansGrid plans={planDtos} />
        </TabsContent>

        <TabsContent value="coupons" className="mt-4">
          <CouponsManager initialCoupons={couponDtos} />
        </TabsContent>

        <TabsContent value="promotions" className="mt-4">
          <PromotionsManager initialPromotions={promotionDtos} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
