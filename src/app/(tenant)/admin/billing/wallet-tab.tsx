'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Progress } from '@/components/ui/progress'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Loader2, Wallet, TrendingUp, Coins, Zap } from 'lucide-react'
import { BillingErrorState } from '@/components/billing/billing-error-state'
import type { BillingOverview } from './page'

interface TopUpPack {
  id: string
  name: string
  tokens: number
  priceUsd: string
  description: string | null
}

interface UsageData {
  usageWindowDays: number
  dailyUsage: { date: string; tokens: number }[]
  featureUsage: { feature: string; tokens: number; costUsd: number }[]
}

const USAGE_WINDOW_OPTIONS = [30, 90, 365] as const

function formatUsd(n: number): string {
  return `$${n.toFixed(2)}`
}

export function WalletTab({ data, onChanged }: { data: BillingOverview; onChanged: () => void }) {
  const router = useRouter()
  const { organization: org, wallet } = data

  const [packs, setPacks] = useState<TopUpPack[] | null>(null)
  const [packsError, setPacksError] = useState(false)
  const [usage, setUsage] = useState<UsageData | null>(null)
  const [usageError, setUsageError] = useState(false)
  const [usageDays, setUsageDays] = useState<(typeof USAGE_WINDOW_OPTIONS)[number]>(30)
  const [buyingPack, setBuyingPack] = useState<TopUpPack | null>(null)
  const [purchasing, setPurchasing] = useState(false)

  const [autoTopUpEnabled, setAutoTopUpEnabled] = useState(org.autoTopUpEnabled)
  const [autoTopUpThreshold, setAutoTopUpThreshold] = useState(
    org.autoTopUpThreshold?.toString() ?? '1000'
  )
  const [autoTopUpPackId, setAutoTopUpPackId] = useState(org.autoTopUpPackId ?? '')
  const [savingAutoTopUp, setSavingAutoTopUp] = useState(false)

  // Fetch-only loaders for the effects below; the reset-and-refetch variants
  // (retryPacks/retryUsage) are reserved for event handlers so no setState
  // runs synchronously inside an effect body.
  const fetchPacks = useCallback(() => {
    fetch('/api/v1/billing/topup-packs')
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load top-up packs')
        return r.json()
      })
      .then((d) => setPacks(d.packs ?? []))
      .catch(() => setPacksError(true))
  }, [])

  const fetchUsage = useCallback((days: number) => {
    fetch(`/api/v1/billing/wallet?days=${days}`)
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load usage data')
        return r.json()
      })
      .then(setUsage)
      .catch(() => setUsageError(true))
  }, [])

  const retryPacks = useCallback(() => {
    setPacksError(false)
    setPacks(null)
    fetchPacks()
  }, [fetchPacks])

  const retryUsage = useCallback(() => {
    setUsageError(false)
    setUsage(null)
    fetchUsage(usageDays)
  }, [fetchUsage, usageDays])

  useEffect(() => {
    fetchPacks()
  }, [fetchPacks])

  useEffect(() => {
    fetchUsage(usageDays)
  }, [usageDays, fetchUsage])

  async function handleBuy() {
    if (!buyingPack) return
    setPurchasing(true)
    try {
      const res = await fetch('/api/v1/billing/topups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packId: buyingPack.id }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Top-up purchase failed')
      toast.success(`Purchased ${buyingPack.tokens.toLocaleString()} tokens`)
      setBuyingPack(null)
      onChanged()
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Top-up purchase failed')
    } finally {
      setPurchasing(false)
    }
  }

  async function handleSaveAutoTopUp() {
    setSavingAutoTopUp(true)
    try {
      const res = await fetch('/api/v1/billing/wallet/auto-topup', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: autoTopUpEnabled,
          threshold: Number(autoTopUpThreshold) || 0,
          packId: autoTopUpPackId || null,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Could not save auto-top-up settings')
      toast.success('Auto-top-up settings saved')
      onChanged()
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSavingAutoTopUp(false)
    }
  }

  if (!org.aiEnabled) {
    return (
      <Card>
        <CardContent className="text-muted-foreground pt-6 text-sm">
          AI features are not enabled for your organization. Contact your account manager to enable
          the AI token wallet.
        </CardContent>
      </Card>
    )
  }

  const balance = wallet?.balance ?? 0
  const budget = org.monthlyTokenBudget
  const used = org.monthlyTokensUsed
  const budgetPct = budget ? Math.min(100, Math.round((used / budget) * 100)) : 0
  const lowBalance = org.autoTopUpEnabled ? balance <= (org.autoTopUpThreshold ?? 0) : balance <= 0

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="flex items-center justify-between pt-6">
            <div>
              <p className="text-muted-foreground text-xs">Token Balance</p>
              <p className="text-3xl font-bold">{balance.toLocaleString()}</p>
              {lowBalance && <p className="text-warning mt-1 text-xs">Balance running low</p>}
            </div>
            <div className="bg-info/10 rounded-lg p-2">
              <Wallet className="text-info h-5 w-5" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between pt-6">
            <div>
              <p className="text-muted-foreground text-xs">Monthly Budget Used</p>
              <p className="text-3xl font-bold">
                {used.toLocaleString()}
                {budget !== null && (
                  <span className="text-muted-foreground text-sm font-normal">
                    {' '}
                    / {budget.toLocaleString()}
                  </span>
                )}
              </p>
              {budget !== null && <Progress value={budgetPct} className="mt-2 h-1.5" />}
            </div>
            <div className="bg-accent/10 rounded-lg p-2">
              <Zap className="text-accent h-5 w-5" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between pt-6">
            <div>
              <p className="text-muted-foreground text-xs">Total Purchased</p>
              <p className="text-3xl font-bold">{(wallet?.totalPurchased ?? 0).toLocaleString()}</p>
            </div>
            <div className="bg-success/10 rounded-lg p-2">
              <TrendingUp className="text-success h-5 w-5" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between pt-6">
            <div>
              <p className="text-muted-foreground text-xs">Total Consumed</p>
              <p className="text-3xl font-bold">{(wallet?.totalConsumed ?? 0).toLocaleString()}</p>
            </div>
            <div className="bg-warning/10 rounded-lg p-2">
              <Coins className="text-warning h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Token Usage (last {usageDays} days)</CardTitle>
          <Select
            value={String(usageDays)}
            onValueChange={(v) => {
              setUsageError(false)
              setUsage(null)
              setUsageDays(Number(v) as (typeof USAGE_WINDOW_OPTIONS)[number])
            }}
          >
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {USAGE_WINDOW_OPTIONS.map((d) => (
                <SelectItem key={d} value={String(d)}>
                  Last {d} days
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          {usageError ? (
            <BillingErrorState message="Could not load usage data." onRetry={retryUsage} />
          ) : !usage ? (
            <div className="flex h-48 items-center justify-center">
              <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={usage.dailyUsage}>
                <defs>
                  <linearGradient id="tokenUsage" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--accent))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--accent))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(v: string) => v.slice(5)}
                  tick={{ fontSize: 11 }}
                />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="tokens"
                  stroke="hsl(var(--accent))"
                  fill="url(#tokenUsage)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {usage && usage.featureUsage.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Usage by Feature</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {usage.featureUsage.map((f) => (
                <div key={f.feature} className="flex items-center justify-between text-sm">
                  <span className="capitalize">{f.feature}</span>
                  <span className="text-muted-foreground">
                    {f.tokens.toLocaleString()} tokens ({formatUsd(f.costUsd)})
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Buy Tokens</CardTitle>
        </CardHeader>
        <CardContent>
          {packsError ? (
            <BillingErrorState message="Could not load top-up packs." onRetry={retryPacks} />
          ) : !packs ? (
            <div className="flex h-24 items-center justify-center">
              <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
            </div>
          ) : packs.length === 0 ? (
            <p className="text-muted-foreground text-sm">No top-up packs are available.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {packs.map((pack) => (
                <Card key={pack.id}>
                  <CardContent className="space-y-2 pt-6">
                    <p className="font-medium">{pack.name}</p>
                    <p className="text-2xl font-bold">{pack.tokens.toLocaleString()}</p>
                    <p className="text-muted-foreground text-xs">tokens</p>
                    {pack.description && (
                      <p className="text-muted-foreground text-xs">{pack.description}</p>
                    )}
                    <p className="text-sm font-medium">${Number(pack.priceUsd).toFixed(2)}</p>
                    <Button size="sm" className="w-full" onClick={() => setBuyingPack(pack)}>
                      Buy
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Auto Top-Up</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Switch checked={autoTopUpEnabled} onCheckedChange={setAutoTopUpEnabled} />
            <Label>Automatically purchase tokens when balance runs low</Label>
          </div>
          {autoTopUpEnabled && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="threshold">Trigger when balance falls below</Label>
                <Input
                  id="threshold"
                  type="number"
                  min={0}
                  value={autoTopUpThreshold}
                  onChange={(e) => setAutoTopUpThreshold(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="autoTopUpPack">Top-up pack to purchase</Label>
                <Select value={autoTopUpPackId} onValueChange={setAutoTopUpPackId}>
                  <SelectTrigger id="autoTopUpPack">
                    <SelectValue placeholder="Select a pack" />
                  </SelectTrigger>
                  <SelectContent>
                    {(packs ?? []).map((pack) => (
                      <SelectItem key={pack.id} value={pack.id}>
                        {pack.name} ({pack.tokens.toLocaleString()} tokens)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <Button
            disabled={savingAutoTopUp || (autoTopUpEnabled && !autoTopUpPackId)}
            onClick={handleSaveAutoTopUp}
          >
            {savingAutoTopUp && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save settings
          </Button>
        </CardContent>
      </Card>

      <Dialog open={!!buyingPack} onOpenChange={(open) => !open && setBuyingPack(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Purchase</DialogTitle>
            <DialogDescription>
              {buyingPack && (
                <>
                  Buy <strong>{buyingPack.tokens.toLocaleString()} tokens</strong> for{' '}
                  <strong>${Number(buyingPack.priceUsd).toFixed(2)}</strong> using your default
                  payment method.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBuyingPack(null)} disabled={purchasing}>
              Cancel
            </Button>
            <Button onClick={handleBuy} disabled={purchasing}>
              {purchasing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm Purchase
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
