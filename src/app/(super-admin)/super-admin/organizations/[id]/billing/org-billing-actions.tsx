'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import type { OrgStatus, SubscriptionPlan, BillingCycle } from '@prisma/client'
import { Button } from '@/components/ui/button'
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
import { Loader2 } from 'lucide-react'

export interface OrgBillingDTO {
  status: OrgStatus
  plan: SubscriptionPlan
  billingCycle: BillingCycle
  monthlyPrice: number
  customPricing: boolean
}

const TIERS: SubscriptionPlan[] = ['STARTER', 'PRO', 'BUSINESS', 'ENTERPRISE']

export function OrgBillingActions({ orgId, org }: { orgId: string; org: OrgBillingDTO }) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)
  const [tier, setTier] = useState<SubscriptionPlan>(org.plan)
  const [cycle, setCycle] = useState<BillingCycle>(org.billingCycle)
  const [customPrice, setCustomPrice] = useState(org.monthlyPrice)

  async function runAction(action: string, body: Record<string, unknown>, successMsg: string) {
    setLoading(action)
    try {
      const res = await fetch(`/api/super-admin/organizations/${orgId}/billing`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...body }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Action failed')
      toast.success(successMsg)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Change Plan</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Tier</Label>
              <Select value={tier} onValueChange={(v) => setTier(v as SubscriptionPlan)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIERS.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Billing cycle</Label>
              <Select value={cycle} onValueChange={(v) => setCycle(v as BillingCycle)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MONTHLY">Monthly</SelectItem>
                  <SelectItem value="ANNUAL">Annual</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button
            disabled={loading !== null || (tier === org.plan && cycle === org.billingCycle)}
            onClick={() =>
              runAction('change_plan', { newTier: tier, billingCycle: cycle }, 'Plan changed')
            }
          >
            {loading === 'change_plan' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Apply plan change (pro-rated)
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Custom Pricing</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="customPrice">Monthly price override (PKR)</Label>
            <Input
              id="customPrice"
              type="number"
              min={0}
              value={customPrice}
              onChange={(e) => setCustomPrice(Number(e.target.value))}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={loading !== null}
              onClick={() =>
                runAction('set_custom_price', { monthlyPrice: customPrice }, 'Custom price set')
              }
            >
              {loading === 'set_custom_price' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Set custom price
            </Button>
            {org.customPricing && (
              <Button
                variant="ghost"
                disabled={loading !== null}
                onClick={() => runAction('clear_custom_price', {}, 'Custom price cleared')}
              >
                {loading === 'clear_custom_price' && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Clear override
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">Lifecycle</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {org.status === 'ACTIVE' && (
            <Button
              variant="outline"
              disabled={loading !== null}
              onClick={() => runAction('mark_past_due', {}, 'Organization marked past due')}
            >
              {loading === 'mark_past_due' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Mark past due
            </Button>
          )}
          {org.status !== 'SUSPENDED' && org.status !== 'CANCELLED' && (
            <Button
              variant="outline"
              disabled={loading !== null}
              onClick={() => runAction('suspend', {}, 'Organization suspended')}
            >
              {loading === 'suspend' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Suspend
            </Button>
          )}
          {org.status !== 'CANCELLED' && (
            <Button
              variant="destructive"
              disabled={loading !== null}
              onClick={() => runAction('cancel', {}, 'Subscription cancelled')}
            >
              {loading === 'cancel' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Cancel subscription
            </Button>
          )}
          {org.status !== 'ACTIVE' && (
            <Button
              disabled={loading !== null}
              onClick={() => runAction('reactivate', {}, 'Organization reactivated')}
            >
              {loading === 'reactivate' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Reactivate
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
