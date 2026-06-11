'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { OrgStatus, SubscriptionPlan, BillingCycle, PaymentProviderType } from '@prisma/client'
import { BillingErrorState } from '@/components/billing/billing-error-state'
import { SubscriptionTab } from './subscription-tab'
import { WalletTab } from './wallet-tab'
import { PaymentMethodsTab } from './payment-methods-tab'
import { BillingHistoryTab } from './billing-history-tab'

export interface BillingPlanDTO {
  id: string
  tier: SubscriptionPlan
  name: string
  description: string | null
  monthlyPrice: string
  annualPrice: string
  setupFee: string
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
}

export interface PaymentMethodDTO {
  id: string
  provider: PaymentProviderType
  providerCustomerId: string | null
  providerPaymentMethodId: string | null
  brand: string | null
  last4: string | null
  expMonth: number | null
  expYear: number | null
  isDefault: boolean
}

export interface WalletDTO {
  id: string
  balance: number
  totalPurchased: number
  totalConsumed: number
  monthlyUsed: number
  monthlyResetAt: string
}

export interface BillingOverview {
  organization: {
    id: string
    name: string
    status: OrgStatus
    plan: SubscriptionPlan
    billingCycle: BillingCycle
    monthlyPrice: string
    customPricing: boolean
    setupFeePaid: boolean
    trialEndsAt: string | null
    subscriptionStart: string | null
    subscriptionEnd: string | null
    nextBillingDate: string | null
    pastDueAt: string | null
    suspendedAt: string | null
    cancelledAt: string | null
    gracePeriodEndsAt: string | null
    aiEnabled: boolean
    monthlyTokenBudget: number | null
    monthlyTokensUsed: number
    autoTopUpEnabled: boolean
    autoTopUpThreshold: number | null
    autoTopUpPackId: string | null
    billingEmail: string | null
    billingName: string | null
    billingPhone: string | null
  }
  plan: BillingPlanDTO | null
  wallet: WalletDTO | null
  defaultPaymentMethod: PaymentMethodDTO | null
  trial: {
    isTrialing: boolean
    daysLeft: number | null
  }
}

const STATUS_VARIANT: Record<
  OrgStatus,
  'success' | 'warning' | 'destructive' | 'secondary' | 'outline' | 'info'
> = {
  TRIAL: 'info',
  ACTIVE: 'success',
  PAST_DUE: 'warning',
  SUSPENDED: 'destructive',
  CANCELLED: 'outline',
}

const STATUS_LABEL: Record<OrgStatus, string> = {
  TRIAL: 'Trial',
  ACTIVE: 'Active',
  PAST_DUE: 'Past Due',
  SUSPENDED: 'Suspended',
  CANCELLED: 'Cancelled',
}

export default function BillingPage() {
  const [data, setData] = useState<BillingOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  // Fetch-only loader for the mount effect (loading starts true); reload()
  // (event handlers only) also resets state so no setState runs synchronously
  // inside the effect body.
  const fetchOverview = useCallback(() => {
    fetch('/api/v1/billing/overview')
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load billing overview')
        return r.json()
      })
      .then(setData)
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [])

  const reload = useCallback(() => {
    setLoading(true)
    setError(false)
    fetchOverview()
  }, [fetchOverview])

  useEffect(() => {
    fetchOverview()
  }, [fetchOverview])

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
      </div>
    )
  }

  if (error || !data) {
    return <BillingErrorState message="Could not load billing information." onRetry={reload} />
  }

  const { organization: org, trial } = data

  return (
    <div className="space-y-6">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold">Billing</h1>
          <Badge variant={STATUS_VARIANT[org.status]}>{STATUS_LABEL[org.status]}</Badge>
          {trial.isTrialing && trial.daysLeft !== null && (
            <Badge variant={trial.daysLeft <= 3 ? 'destructive' : 'warning'}>
              {trial.daysLeft > 0
                ? `${trial.daysLeft} day${trial.daysLeft === 1 ? '' : 's'} left in trial`
                : 'Trial ended'}
            </Badge>
          )}
        </div>
        <p className="text-muted-foreground text-sm">
          Manage your subscription, AI token wallet, payment methods, and invoices.
        </p>
      </div>

      <Tabs defaultValue="subscription">
        <TabsList>
          <TabsTrigger value="subscription">Subscription</TabsTrigger>
          <TabsTrigger value="wallet">AI Token Wallet</TabsTrigger>
          <TabsTrigger value="payment-methods">Payment Methods</TabsTrigger>
          <TabsTrigger value="history">Billing History</TabsTrigger>
        </TabsList>
        <TabsContent value="subscription" className="mt-4">
          <SubscriptionTab data={data} onChanged={reload} />
        </TabsContent>
        <TabsContent value="wallet" className="mt-4">
          <WalletTab data={data} onChanged={reload} />
        </TabsContent>
        <TabsContent value="payment-methods" className="mt-4">
          <PaymentMethodsTab onChanged={reload} />
        </TabsContent>
        <TabsContent value="history" className="mt-4">
          <BillingHistoryTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
