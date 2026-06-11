'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import type { SubscriptionPlan, BillingCycle } from '@prisma/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, Check, Tag } from 'lucide-react'
import { cn } from '@/lib/utils'
import { BillingErrorState } from '@/components/billing/billing-error-state'
import type { BillingOverview, BillingPlanDTO } from './page'

const TIERS: SubscriptionPlan[] = ['STARTER', 'PRO', 'BUSINESS', 'ENTERPRISE']

function formatPkr(n: number): string {
  return `Rs ${n.toLocaleString()}`
}

function planPrice(plan: BillingPlanDTO, cycle: BillingCycle): number {
  return cycle === 'ANNUAL' ? Number(plan.annualPrice) : Number(plan.monthlyPrice)
}

export function SubscriptionTab({
  data,
  onChanged,
}: {
  data: BillingOverview
  onChanged: () => void
}) {
  const router = useRouter()
  const { organization: org } = data
  const [plans, setPlans] = useState<BillingPlanDTO[] | null>(null)
  const [plansError, setPlansError] = useState(false)
  const [tier, setTier] = useState<SubscriptionPlan>(org.plan)
  const [cycle, setCycle] = useState<BillingCycle>(org.billingCycle)
  const [couponCode, setCouponCode] = useState('')
  const [couponPreview, setCouponPreview] = useState<{
    discountAmount: number
    description: string | null
  } | null>(null)
  const [applyingCoupon, setApplyingCoupon] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Fetch-only loader for the mount effect; retryPlans (event handler) also
  // resets state so no setState runs synchronously inside the effect body.
  const fetchPlans = useCallback(() => {
    fetch('/api/v1/billing/plans')
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load plans')
        return r.json()
      })
      .then((d) => setPlans(d.plans ?? []))
      .catch(() => setPlansError(true))
  }, [])

  const retryPlans = useCallback(() => {
    setPlansError(false)
    setPlans(null)
    fetchPlans()
  }, [fetchPlans])

  useEffect(() => {
    fetchPlans()
  }, [fetchPlans])

  const selectedPlan = plans?.find((p) => p.tier === tier)
  const selectionUnchanged = tier === org.plan && cycle === org.billingCycle
  const canSubscribe = org.status === 'TRIAL'
  const canChangePlan = org.status === 'ACTIVE' || org.status === 'PAST_DUE'

  async function applyCoupon() {
    const code = couponCode.trim()
    if (!code) return
    setApplyingCoupon(true)
    try {
      const res = await fetch('/api/v1/billing/coupons/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, tier, billingCycle: cycle }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Invalid coupon code')
      setCouponPreview({ discountAmount: json.discountAmount, description: json.description })
      toast.success('Coupon applied')
    } catch (err) {
      setCouponPreview(null)
      toast.error(err instanceof Error ? err.message : 'Invalid coupon code')
    } finally {
      setApplyingCoupon(false)
    }
  }

  async function handleSubscribe() {
    setSubmitting(true)
    try {
      const res = await fetch('/api/v1/billing/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tier,
          billingCycle: cycle,
          couponCode: couponCode.trim() || undefined,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Could not start your subscription')
      toast.success('Subscription activated — welcome aboard!')
      onChanged()
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleChangePlan() {
    setSubmitting(true)
    try {
      const res = await fetch('/api/v1/billing/change-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newTier: tier, billingCycle: cycle }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Could not change your plan')

      const proration = json.proration as
        | { netAmount: number; daysRemaining: number }
        | null
        | undefined
      if (proration && proration.netAmount > 0) {
        toast.success(
          `Plan changed. ${formatPkr(proration.netAmount)} charged for the remaining ${proration.daysRemaining} day(s) of this cycle.`
        )
      } else if (proration && proration.netAmount < 0) {
        toast.success(
          `Plan changed. ${formatPkr(Math.abs(proration.netAmount))} credit will be applied to your next invoice.`
        )
      } else {
        toast.success('Plan changed.')
      }
      onChanged()
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  if (plansError) {
    return <BillingErrorState message="Could not load subscription plans." onRetry={retryPlans} />
  }

  if (!plans) {
    return (
      <div className="flex h-48 items-center justify-center">
        <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Current Subscription</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-muted-foreground text-xs">Plan</p>
            <p className="font-medium">{data.plan?.name ?? org.plan}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Billing cycle</p>
            <p className="font-medium">{org.billingCycle === 'ANNUAL' ? 'Annual' : 'Monthly'}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Price</p>
            <p className="font-medium">
              {formatPkr(Number(org.monthlyPrice))}
              {org.customPricing && (
                <Badge variant="info" className="ml-2">
                  Custom
                </Badge>
              )}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Next billing date</p>
            <p className="font-medium">
              {org.nextBillingDate ? new Date(org.nextBillingDate).toLocaleDateString() : '—'}
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Available Plans</h2>
        <div className="flex items-center gap-2">
          <Label className="text-sm font-normal">Billing cycle</Label>
          <Select value={cycle} onValueChange={(v) => setCycle(v as BillingCycle)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="MONTHLY">Monthly</SelectItem>
              <SelectItem value="ANNUAL">Annual</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {TIERS.map((t) => {
          const plan = plans.find((p) => p.tier === t)
          if (!plan) return null
          const isCurrent = t === org.plan
          const isSelected = t === tier
          return (
            <Card
              key={t}
              role="button"
              tabIndex={0}
              onClick={() => setTier(t)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') setTier(t)
              }}
              className={cn(
                'cursor-pointer transition-colors',
                isSelected ? 'border-primary ring-primary/30 ring-2' : 'hover:border-primary/50'
              )}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{plan.name}</CardTitle>
                  {isCurrent && <Badge variant="success">Current</Badge>}
                </div>
                {plan.description && (
                  <p className="text-muted-foreground text-xs">{plan.description}</p>
                )}
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p className="text-2xl font-bold">
                  {formatPkr(planPrice(plan, cycle))}
                  <span className="text-muted-foreground text-sm font-normal">
                    {' '}
                    / {cycle === 'ANNUAL' ? 'year' : 'month'}
                  </span>
                </p>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Max users</span>
                  <span>{plan.maxUsers ?? 'Unlimited'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">AI tokens / mo</span>
                  <span>{plan.aiTokensIncluded.toLocaleString()}</span>
                </div>
                {plan.features.length > 0 && (
                  <ul className="space-y-1 pt-2">
                    {plan.features.slice(0, 4).map((f) => (
                      <li key={f} className="flex items-start gap-1.5 text-xs">
                        <Check className="text-primary mt-0.5 h-3 w-3 shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {(canSubscribe || canChangePlan) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {canSubscribe ? 'Activate Subscription' : 'Change Plan'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {canSubscribe && (
              <div className="space-y-2">
                <Label htmlFor="couponCode">Coupon code (optional)</Label>
                <div className="flex gap-2">
                  <Input
                    id="couponCode"
                    value={couponCode}
                    onChange={(e) => {
                      setCouponCode(e.target.value.toUpperCase())
                      setCouponPreview(null)
                    }}
                    placeholder="LAUNCH50"
                    className="max-w-xs"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    disabled={applyingCoupon || !couponCode.trim()}
                    onClick={applyCoupon}
                  >
                    {applyingCoupon ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Tag className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                {couponPreview && (
                  <p className="text-success text-sm">
                    {couponPreview.description ?? 'Coupon valid'} — discount of{' '}
                    {formatPkr(couponPreview.discountAmount)}
                  </p>
                )}
              </div>
            )}

            {selectedPlan && (
              <div className="text-sm">
                <p>
                  Selected: <span className="font-medium">{selectedPlan.name}</span> (
                  {cycle === 'ANNUAL' ? 'Annual' : 'Monthly'}) —{' '}
                  <span className="font-medium">{formatPkr(planPrice(selectedPlan, cycle))}</span>
                  {couponPreview && couponPreview.discountAmount > 0 && (
                    <>
                      {' '}
                      &rarr;{' '}
                      <span className="text-success font-medium">
                        {formatPkr(
                          Math.max(0, planPrice(selectedPlan, cycle) - couponPreview.discountAmount)
                        )}
                      </span>
                    </>
                  )}
                  {!org.setupFeePaid && Number(selectedPlan.setupFee) > 0 && (
                    <> + {formatPkr(Number(selectedPlan.setupFee))} one-time setup fee</>
                  )}
                </p>
              </div>
            )}

            {canSubscribe && (
              <Button disabled={submitting} onClick={handleSubscribe}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Activate subscription
              </Button>
            )}
            {canChangePlan && (
              <Button disabled={submitting || selectionUnchanged} onClick={handleChangePlan}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Apply plan change
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {(org.status === 'SUSPENDED' || org.status === 'CANCELLED') && (
        <Card>
          <CardContent className="text-muted-foreground pt-6 text-sm">
            Your subscription is {org.status.toLowerCase()}. To reactivate, please update your
            payment method and contact support — our team will restore your plan.
          </CardContent>
        </Card>
      )}
    </div>
  )
}
