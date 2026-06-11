'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import type { SubscriptionPlan } from '@prisma/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Loader2, Pencil } from 'lucide-react'

export interface PlanDTO {
  tier: SubscriptionPlan
  name: string
  description: string | null
  monthlyPrice: number
  annualPrice: number
  setupFee: number
  maxUsers: number | null
  aiTokensIncluded: number
  aiEnabled: boolean
  perUserQuotasEnabled: boolean
  invoiceTemplateLimit: number | null
  customDomain: boolean
  prioritySupport: boolean
  sla: string | null
  features: string[]
  isActive: boolean
  sortOrder: number
  configured: boolean
}

function formatPkr(n: number): string {
  return `Rs ${n.toLocaleString()}`
}

export function PlansGrid({ plans }: { plans: PlanDTO[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {plans.map((plan) => (
        <PlanCard key={plan.tier} plan={plan} />
      ))}
    </div>
  )
}

function PlanCard({ plan }: { plan: PlanDTO }) {
  const [open, setOpen] = useState(false)

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{plan.name}</CardTitle>
          {!plan.configured ? (
            <Badge variant="outline">Not configured</Badge>
          ) : plan.isActive ? (
            <Badge variant="success">Active</Badge>
          ) : (
            <Badge variant="secondary">Inactive</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Monthly</span>
          <span className="font-medium">{formatPkr(plan.monthlyPrice)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Annual</span>
          <span className="font-medium">{formatPkr(plan.annualPrice)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Setup fee</span>
          <span className="font-medium">{formatPkr(plan.setupFee)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Max users</span>
          <span className="font-medium">{plan.maxUsers ?? 'Unlimited'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">AI tokens / mo</span>
          <span className="font-medium">{plan.aiTokensIncluded.toLocaleString()}</span>
        </div>
        <div className="flex flex-wrap gap-1 pt-1">
          {plan.aiEnabled && <Badge variant="info">AI</Badge>}
          {plan.perUserQuotasEnabled && <Badge variant="info">Per-user quotas</Badge>}
          {plan.customDomain && <Badge variant="info">Custom domain</Badge>}
          {plan.prioritySupport && <Badge variant="info">Priority support</Badge>}
        </div>
      </CardContent>
      <CardFooter>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="w-full">
              <Pencil className="mr-2 h-3.5 w-3.5" />
              Edit
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
            <PlanEditForm plan={plan} onSaved={() => setOpen(false)} />
          </DialogContent>
        </Dialog>
      </CardFooter>
    </Card>
  )
}

function PlanEditForm({ plan, onSaved }: { plan: PlanDTO; onSaved: () => void }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    name: plan.name,
    description: plan.description ?? '',
    monthlyPrice: plan.monthlyPrice,
    annualPrice: plan.annualPrice,
    setupFee: plan.setupFee,
    maxUsers: plan.maxUsers,
    aiTokensIncluded: plan.aiTokensIncluded,
    aiEnabled: plan.aiEnabled,
    perUserQuotasEnabled: plan.perUserQuotasEnabled,
    invoiceTemplateLimit: plan.invoiceTemplateLimit,
    customDomain: plan.customDomain,
    prioritySupport: plan.prioritySupport,
    sla: plan.sla ?? '',
    features: plan.features.join('\n'),
    isActive: plan.isActive,
    sortOrder: plan.sortOrder,
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/super-admin/billing/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tier: plan.tier,
          name: form.name,
          description: form.description || null,
          monthlyPrice: Number(form.monthlyPrice),
          annualPrice: Number(form.annualPrice),
          setupFee: Number(form.setupFee),
          maxUsers: form.maxUsers === null ? null : Number(form.maxUsers),
          aiTokensIncluded: Number(form.aiTokensIncluded),
          aiEnabled: form.aiEnabled,
          perUserQuotasEnabled: form.perUserQuotasEnabled,
          invoiceTemplateLimit:
            form.invoiceTemplateLimit === null ? null : Number(form.invoiceTemplateLimit),
          customDomain: form.customDomain,
          prioritySupport: form.prioritySupport,
          sla: form.sla || null,
          features: form.features
            .split('\n')
            .map((f) => f.trim())
            .filter(Boolean),
          isActive: form.isActive,
          sortOrder: Number(form.sortOrder),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to save plan')
      toast.success(`${form.name} plan saved`)
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
        <DialogTitle>{plan.name} plan</DialogTitle>
        <DialogDescription>Tier: {plan.tier}</DialogDescription>
      </DialogHeader>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="name">Display name</Label>
          <Input
            id="name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="sortOrder">Sort order</Label>
          <Input
            id="sortOrder"
            type="number"
            value={form.sortOrder}
            onChange={(e) => setForm((f) => ({ ...f, sortOrder: Number(e.target.value) }))}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          rows={2}
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="monthlyPrice">Monthly price (PKR)</Label>
          <Input
            id="monthlyPrice"
            type="number"
            min={0}
            value={form.monthlyPrice}
            onChange={(e) => setForm((f) => ({ ...f, monthlyPrice: Number(e.target.value) }))}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="annualPrice">Annual price (PKR)</Label>
          <Input
            id="annualPrice"
            type="number"
            min={0}
            value={form.annualPrice}
            onChange={(e) => setForm((f) => ({ ...f, annualPrice: Number(e.target.value) }))}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="setupFee">Setup fee (PKR)</Label>
          <Input
            id="setupFee"
            type="number"
            min={0}
            value={form.setupFee}
            onChange={(e) => setForm((f) => ({ ...f, setupFee: Number(e.target.value) }))}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="maxUsers">Max users (blank = unlimited)</Label>
          <Input
            id="maxUsers"
            type="number"
            min={1}
            value={form.maxUsers ?? ''}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                maxUsers: e.target.value === '' ? null : Number(e.target.value),
              }))
            }
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="aiTokensIncluded">AI tokens / month</Label>
          <Input
            id="aiTokensIncluded"
            type="number"
            min={0}
            value={form.aiTokensIncluded}
            onChange={(e) => setForm((f) => ({ ...f, aiTokensIncluded: Number(e.target.value) }))}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="invoiceTemplateLimit">Invoice templates (blank = unlimited)</Label>
          <Input
            id="invoiceTemplateLimit"
            type="number"
            min={1}
            value={form.invoiceTemplateLimit ?? ''}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                invoiceTemplateLimit: e.target.value === '' ? null : Number(e.target.value),
              }))
            }
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="sla">SLA</Label>
        <Input
          id="sla"
          value={form.sla}
          onChange={(e) => setForm((f) => ({ ...f, sla: e.target.value }))}
          placeholder="e.g. 99.9% uptime, 24h response"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="features">Marketing features (one per line)</Label>
        <Textarea
          id="features"
          rows={4}
          value={form.features}
          onChange={(e) => setForm((f) => ({ ...f, features: e.target.value }))}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <ToggleRow
          label="AI features enabled"
          checked={form.aiEnabled}
          onChange={(v) => setForm((f) => ({ ...f, aiEnabled: v }))}
        />
        <ToggleRow
          label="Per-user AI quotas"
          checked={form.perUserQuotasEnabled}
          onChange={(v) => setForm((f) => ({ ...f, perUserQuotasEnabled: v }))}
        />
        <ToggleRow
          label="Custom domain"
          checked={form.customDomain}
          onChange={(v) => setForm((f) => ({ ...f, customDomain: v }))}
        />
        <ToggleRow
          label="Priority support"
          checked={form.prioritySupport}
          onChange={(v) => setForm((f) => ({ ...f, prioritySupport: v }))}
        />
        <ToggleRow
          label="Plan active (visible to tenants)"
          checked={form.isActive}
          onChange={(v) => setForm((f) => ({ ...f, isActive: v }))}
        />
      </div>

      <DialogFooter>
        <Button type="submit" disabled={loading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save plan
        </Button>
      </DialogFooter>
    </form>
  )
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border px-3 py-2">
      <Label className="text-sm font-normal">{label}</Label>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  )
}
