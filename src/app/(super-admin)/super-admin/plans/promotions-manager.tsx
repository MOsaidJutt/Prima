'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import type { CouponDiscountType, PromotionAppliesTo } from '@prisma/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
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

export interface PromotionDTO {
  id: string
  name: string
  description: string | null
  discountType: CouponDiscountType | null
  discountValue: number | null
  setupFeeWaiver: boolean
  bonusTokens: number
  appliesTo: PromotionAppliesTo
  startsAt: string | null
  endsAt: string | null
  isActive: boolean
}

function formatDiscount(p: PromotionDTO): string {
  if (!p.discountType || p.discountValue === null) return '—'
  return p.discountType === 'PERCENT'
    ? `${p.discountValue}%`
    : `Rs ${p.discountValue.toLocaleString()}`
}

const APPLIES_TO_LABELS: Record<PromotionAppliesTo, string> = {
  ALL: 'All checkouts',
  ANNUAL: 'Annual plans',
  NEW_SIGNUPS: 'New signups',
}

export function PromotionsManager({ initialPromotions }: { initialPromotions: PromotionDTO[] }) {
  const router = useRouter()
  const [createOpen, setCreateOpen] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  async function toggleActive(promo: PromotionDTO) {
    setBusyId(promo.id)
    try {
      const res = await fetch(`/api/super-admin/billing/promotions/${promo.id}`, {
        method: promo.isActive ? 'DELETE' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: promo.isActive ? undefined : JSON.stringify({ isActive: true }),
      })
      if (!res.ok) throw new Error('Failed to update promotion')
      toast.success(promo.isActive ? 'Promotion deactivated' : 'Promotion activated')
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>Promotions</CardTitle>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" />
              New Promotion
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
            <PromotionForm onSaved={() => setCreateOpen(false)} />
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 sticky top-0 z-10 border-b">
                <th className="text-muted-foreground px-4 py-3 text-left font-medium">Name</th>
                <th className="text-muted-foreground px-4 py-3 text-left font-medium">Discount</th>
                <th className="text-muted-foreground px-4 py-3 text-left font-medium">Extras</th>
                <th className="text-muted-foreground px-4 py-3 text-left font-medium">
                  Applies to
                </th>
                <th className="text-muted-foreground px-4 py-3 text-left font-medium">Window</th>
                <th className="text-muted-foreground px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {initialPromotions.map((p) => (
                <tr key={p.id} className="hover:bg-muted/40 border-b transition-colors">
                  <td className="px-4 py-3 font-medium">{p.name}</td>
                  <td className="px-4 py-3">{formatDiscount(p)}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {p.setupFeeWaiver && <Badge variant="info">Setup waived</Badge>}
                      {p.bonusTokens > 0 && (
                        <Badge variant="info">+{p.bonusTokens.toLocaleString()} tokens</Badge>
                      )}
                    </div>
                  </td>
                  <td className="text-muted-foreground px-4 py-3">
                    {APPLIES_TO_LABELS[p.appliesTo]}
                  </td>
                  <td className="text-muted-foreground px-4 py-3 text-xs">
                    {p.startsAt ? new Date(p.startsAt).toLocaleDateString() : '—'}
                    {' → '}
                    {p.endsAt ? new Date(p.endsAt).toLocaleDateString() : 'No end'}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={p.isActive ? 'success' : 'secondary'}>
                      {p.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busyId === p.id}
                      onClick={() => toggleActive(p)}
                    >
                      {busyId === p.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : p.isActive ? (
                        'Deactivate'
                      ) : (
                        'Activate'
                      )}
                    </Button>
                  </td>
                </tr>
              ))}
              {initialPromotions.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-muted-foreground px-4 py-8 text-center">
                    No promotions created yet.
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

function PromotionForm({ onSaved }: { onSaved: () => void }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    name: '',
    description: '',
    discountType: 'NONE' as 'NONE' | CouponDiscountType,
    discountValue: 0,
    setupFeeWaiver: false,
    bonusTokens: 0,
    appliesTo: 'ALL' as PromotionAppliesTo,
    startsAt: '',
    endsAt: '',
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/super-admin/billing/promotions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          description: form.description || null,
          discountType: form.discountType === 'NONE' ? null : form.discountType,
          discountValue: form.discountType === 'NONE' ? null : Number(form.discountValue),
          setupFeeWaiver: form.setupFeeWaiver,
          bonusTokens: Number(form.bonusTokens),
          appliesTo: form.appliesTo,
          startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : null,
          endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to create promotion')
      toast.success('Promotion created')
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
        <DialogTitle>New Promotion</DialogTitle>
        <DialogDescription>Applied automatically at checkout — no code needed</DialogDescription>
      </DialogHeader>

      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          placeholder="Annual plan launch discount"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Input
          id="description"
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
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
          <Label>Applies to</Label>
          <Select
            value={form.appliesTo}
            onValueChange={(v) => setForm((f) => ({ ...f, appliesTo: v as PromotionAppliesTo }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All checkouts</SelectItem>
              <SelectItem value="ANNUAL">Annual plans only</SelectItem>
              <SelectItem value="NEW_SIGNUPS">New signups only</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="startsAt">Starts at (blank = immediately)</Label>
          <Input
            id="startsAt"
            type="date"
            value={form.startsAt}
            onChange={(e) => setForm((f) => ({ ...f, startsAt: e.target.value }))}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="endsAt">Ends at (blank = no end)</Label>
          <Input
            id="endsAt"
            type="date"
            value={form.endsAt}
            onChange={(e) => setForm((f) => ({ ...f, endsAt: e.target.value }))}
          />
        </div>
      </div>

      <div className="flex items-center justify-between rounded-lg border px-3 py-2">
        <Label className="text-sm font-normal">Waive setup fee</Label>
        <Switch
          checked={form.setupFeeWaiver}
          onCheckedChange={(v) => setForm((f) => ({ ...f, setupFeeWaiver: v }))}
        />
      </div>

      <DialogFooter>
        <Button type="submit" disabled={loading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Create promotion
        </Button>
      </DialogFooter>
    </form>
  )
}
