'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import type { CouponDiscountType, SubscriptionPlan } from '@prisma/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Loader2, Plus } from 'lucide-react'

export interface CouponDTO {
  id: string
  code: string
  description: string | null
  discountType: CouponDiscountType | null
  discountValue: number | null
  setupFeeWaiver: boolean
  bonusTokens: number
  applicablePlans: SubscriptionPlan[]
  maxRedemptions: number | null
  redemptionCount: number
  validFrom: string
  validUntil: string | null
  isActive: boolean
}

const ALL_TIERS: SubscriptionPlan[] = ['STARTER', 'PRO', 'BUSINESS', 'ENTERPRISE']

function formatDiscount(c: CouponDTO): string {
  if (!c.discountType || c.discountValue === null) return '—'
  return c.discountType === 'PERCENT'
    ? `${c.discountValue}%`
    : `Rs ${c.discountValue.toLocaleString()}`
}

export function CouponsManager({ initialCoupons }: { initialCoupons: CouponDTO[] }) {
  const router = useRouter()
  const [createOpen, setCreateOpen] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  async function toggleActive(coupon: CouponDTO) {
    setBusyId(coupon.id)
    try {
      const res = await fetch(`/api/super-admin/billing/coupons/${coupon.id}`, {
        method: coupon.isActive ? 'DELETE' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: coupon.isActive ? undefined : JSON.stringify({ isActive: true }),
      })
      if (!res.ok) throw new Error('Failed to update coupon')
      toast.success(coupon.isActive ? 'Coupon deactivated' : 'Coupon activated')
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setBusyId(null)
    }
  }

  const totalRedemptions = initialCoupons.reduce((sum, c) => sum + c.redemptionCount, 0)
  const activeCoupons = initialCoupons.filter((c) => c.isActive).length

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle>Coupon Codes</CardTitle>
          <p className="text-muted-foreground mt-1 text-xs">
            {totalRedemptions.toLocaleString()} total redemption{totalRedemptions === 1 ? '' : 's'}{' '}
            across {activeCoupons} active coupon{activeCoupons === 1 ? '' : 's'}
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" />
              New Coupon
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
            <CouponForm onSaved={() => setCreateOpen(false)} />
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 sticky top-0 z-10 border-b">
                <th className="text-muted-foreground px-4 py-3 text-left font-medium">Code</th>
                <th className="text-muted-foreground px-4 py-3 text-left font-medium">Discount</th>
                <th className="text-muted-foreground px-4 py-3 text-left font-medium">Extras</th>
                <th className="text-muted-foreground px-4 py-3 text-left font-medium">Plans</th>
                <th className="text-muted-foreground px-4 py-3 text-left font-medium">
                  Redemptions
                </th>
                <th className="text-muted-foreground px-4 py-3 text-left font-medium">
                  Valid until
                </th>
                <th className="text-muted-foreground px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {initialCoupons.map((c) => (
                <tr key={c.id} className="hover:bg-muted/40 border-b transition-colors">
                  <td className="px-4 py-3 font-mono font-medium">{c.code}</td>
                  <td className="px-4 py-3">{formatDiscount(c)}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {c.setupFeeWaiver && <Badge variant="info">Setup waived</Badge>}
                      {c.bonusTokens > 0 && (
                        <Badge variant="info">+{c.bonusTokens.toLocaleString()} tokens</Badge>
                      )}
                    </div>
                  </td>
                  <td className="text-muted-foreground px-4 py-3">
                    {c.applicablePlans.length === 0 ? 'All' : c.applicablePlans.join(', ')}
                  </td>
                  <td className="px-4 py-3">
                    {c.redemptionCount}
                    {c.maxRedemptions ? ` / ${c.maxRedemptions}` : ''}
                  </td>
                  <td className="text-muted-foreground px-4 py-3">
                    {c.validUntil ? new Date(c.validUntil).toLocaleDateString() : 'No expiry'}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={c.isActive ? 'success' : 'secondary'}>
                      {c.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busyId === c.id}
                      onClick={() => toggleActive(c)}
                    >
                      {busyId === c.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : c.isActive ? (
                        'Deactivate'
                      ) : (
                        'Activate'
                      )}
                    </Button>
                  </td>
                </tr>
              ))}
              {initialCoupons.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-muted-foreground px-4 py-8 text-center">
                    No coupons created yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}

function CouponForm({ onSaved }: { onSaved: () => void }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    code: '',
    description: '',
    discountType: 'NONE' as 'NONE' | CouponDiscountType,
    discountValue: 0,
    setupFeeWaiver: false,
    bonusTokens: 0,
    applicablePlans: [] as SubscriptionPlan[],
    maxRedemptions: null as number | null,
    validUntil: '',
  })

  function togglePlan(tier: SubscriptionPlan) {
    setForm((f) => ({
      ...f,
      applicablePlans: f.applicablePlans.includes(tier)
        ? f.applicablePlans.filter((t) => t !== tier)
        : [...f.applicablePlans, tier],
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/super-admin/billing/coupons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: form.code,
          description: form.description || null,
          discountType: form.discountType === 'NONE' ? null : form.discountType,
          discountValue: form.discountType === 'NONE' ? null : Number(form.discountValue),
          setupFeeWaiver: form.setupFeeWaiver,
          bonusTokens: Number(form.bonusTokens),
          applicablePlans: form.applicablePlans,
          maxRedemptions: form.maxRedemptions,
          validUntil: form.validUntil ? new Date(form.validUntil).toISOString() : null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to create coupon')
      toast.success('Coupon created')
      onSaved()
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <DialogHeader>
        <DialogTitle>New Coupon</DialogTitle>
        <DialogDescription>Tenants apply this code at checkout</DialogDescription>
      </DialogHeader>

      <div className="space-y-2">
        <Label htmlFor="code">Code</Label>
        <Input
          id="code"
          value={form.code}
          onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
          placeholder="LAUNCH50"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Input
          id="description"
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          placeholder="50% off first month"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Discount type</Label>
          <Select
            value={form.discountType}
            onValueChange={(v) =>
              setForm((f) => ({ ...f, discountType: v as 'NONE' | CouponDiscountType }))
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="NONE">None</SelectItem>
              <SelectItem value="PERCENT">Percent</SelectItem>
              <SelectItem value="FLAT">Flat (PKR)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="discountValue">Discount value</Label>
          <Input
            id="discountValue"
            type="number"
            min={0}
            disabled={form.discountType === 'NONE'}
            value={form.discountValue}
            onChange={(e) => setForm((f) => ({ ...f, discountValue: Number(e.target.value) }))}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="bonusTokens">Bonus AI tokens</Label>
          <Input
            id="bonusTokens"
            type="number"
            min={0}
            value={form.bonusTokens}
            onChange={(e) => setForm((f) => ({ ...f, bonusTokens: Number(e.target.value) }))}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="maxRedemptions">Max redemptions (blank = unlimited)</Label>
          <Input
            id="maxRedemptions"
            type="number"
            min={1}
            value={form.maxRedemptions ?? ''}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                maxRedemptions: e.target.value === '' ? null : Number(e.target.value),
              }))
            }
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="validUntil">Valid until (blank = no expiry)</Label>
        <Input
          id="validUntil"
          type="date"
          value={form.validUntil}
          onChange={(e) => setForm((f) => ({ ...f, validUntil: e.target.value }))}
        />
      </div>

      <div className="flex items-center justify-between rounded-lg border px-3 py-2">
        <Label className="text-sm font-normal">Waive setup fee</Label>
        <Switch
          checked={form.setupFeeWaiver}
          onCheckedChange={(v) => setForm((f) => ({ ...f, setupFeeWaiver: v }))}
        />
      </div>

      <div className="space-y-2">
        <Label>Applicable plans (none selected = all plans)</Label>
        <div className="flex flex-wrap gap-4">
          {ALL_TIERS.map((tier) => (
            <label key={tier} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={form.applicablePlans.includes(tier)}
                onCheckedChange={() => togglePlan(tier)}
              />
              {tier}
            </label>
          ))}
        </div>
      </div>

      <DialogFooter>
        <Button type="submit" disabled={loading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Create coupon
        </Button>
      </DialogFooter>
    </form>
  )
}
