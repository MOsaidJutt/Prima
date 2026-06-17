import { notFound } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft } from 'lucide-react'
import type { OrgStatus, PlatformPaymentStatus, TopUpOrderStatus } from '@prisma/client'
import { OrgBillingActions } from './org-billing-actions'
import { ReconcilePaymentButton } from './reconcile-payment-button'

export const metadata = { title: 'Organization Billing' }

const statusVariant: Record<
  OrgStatus,
  'success' | 'warning' | 'destructive' | 'secondary' | 'outline'
> = {
  ACTIVE: 'success',
  TRIAL: 'warning',
  PAST_DUE: 'destructive',
  SUSPENDED: 'destructive',
  CANCELLED: 'outline',
}

const paymentStatusVariant: Record<
  PlatformPaymentStatus,
  'success' | 'warning' | 'destructive' | 'secondary'
> = {
  SUCCEEDED: 'success',
  PENDING: 'warning',
  FAILED: 'destructive',
  REFUNDED: 'secondary',
}

const topUpStatusVariant: Record<
  TopUpOrderStatus,
  'success' | 'warning' | 'destructive' | 'secondary'
> = {
  COMPLETED: 'success',
  PENDING: 'warning',
  FAILED: 'destructive',
  REFUNDED: 'secondary',
}

const ORG_BILLING_SELECT = {
  id: true,
  name: true,
  slug: true,
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
  lastReminderSentAt: true,
  stripeCustomerId: true,
  aiEnabled: true,
  monthlyTokenBudget: true,
  monthlyTokensUsed: true,
  autoTopUpEnabled: true,
  autoTopUpThreshold: true,
  autoTopUpPackId: true,
  billingEmail: true,
  billingName: true,
  billingPhone: true,
} as const

function formatPkr(n: number): string {
  return `Rs ${n.toLocaleString()}`
}

function formatDate(d: Date | string | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString()
}

function formatDateTime(d: Date | string | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleString()
}

export default async function OrgBillingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const org = await prisma.organization.findFirst({
    where: { id, deletedAt: null },
    select: ORG_BILLING_SELECT,
  })
  if (!org) notFound()

  const [billingPlan, wallet, paymentMethods, recentPayments, invoices, topUpOrders] =
    await Promise.all([
      prisma.billingPlan.findUnique({ where: { tier: org.plan } }),
      prisma.tokenWallet.findUnique({ where: { organizationId: id } }),
      prisma.billingPaymentMethod.findMany({
        where: { organizationId: id },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
      }),
      prisma.platformPayment.findMany({
        where: { organizationId: id },
        orderBy: { createdAt: 'desc' },
        take: 25,
      }),
      prisma.organizationInvoice.findMany({
        where: { organizationId: id, deletedAt: null },
        orderBy: { issueDate: 'desc' },
        take: 12,
      }),
      prisma.tokenTopUpOrder.findMany({
        where: { organizationId: id },
        orderBy: { createdAt: 'desc' },
        take: 25,
        include: { pack: { select: { name: true } } },
      }),
    ])

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" aria-label="Back to organization" asChild>
          <Link href={`/super-admin/organizations/${id}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{org.name}</h1>
            <Badge variant={statusVariant[org.status]}>{org.status}</Badge>
          </div>
          <p className="text-muted-foreground text-sm">
            Billing &middot; {billingPlan?.name ?? org.plan} ({org.billingCycle})
          </p>
        </div>
      </div>

      <OrgBillingActions
        orgId={id}
        org={{
          status: org.status,
          plan: org.plan,
          billingCycle: org.billingCycle,
          monthlyPrice: Number(org.monthlyPrice),
          customPricing: org.customPricing,
        }}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Subscription</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Plan" value={`${billingPlan?.name ?? org.plan} (${org.plan})`} />
            <Row label="Billing cycle" value={org.billingCycle} />
            <Row
              label="Monthly price"
              value={`${formatPkr(Number(org.monthlyPrice))}${org.customPricing ? ' (custom)' : ''}`}
            />
            <Row label="Setup fee paid" value={org.setupFeePaid ? 'Yes' : 'No'} />
            <Row label="Trial ends" value={formatDate(org.trialEndsAt)} />
            <Row label="Subscription start" value={formatDate(org.subscriptionStart)} />
            <Row label="Subscription end" value={formatDate(org.subscriptionEnd)} />
            <Row label="Next billing date" value={formatDate(org.nextBillingDate)} />
            <Row label="Past due since" value={formatDate(org.pastDueAt)} />
            <Row label="Suspended since" value={formatDate(org.suspendedAt)} />
            <Row label="Cancelled at" value={formatDate(org.cancelledAt)} />
            <Row label="Grace period ends" value={formatDate(org.gracePeriodEndsAt)} />
            <Row label="Last reminder sent" value={formatDateTime(org.lastReminderSentAt)} />
            <Row label="Stripe customer" value={org.stripeCustomerId ?? '—'} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">AI Token Wallet</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="AI enabled" value={org.aiEnabled ? 'Yes' : 'No'} />
            <Row label="Monthly token budget" value={org.monthlyTokenBudget.toLocaleString()} />
            <Row label="Monthly tokens used" value={org.monthlyTokensUsed.toLocaleString()} />
            <Row label="Wallet balance" value={(wallet?.balance ?? 0).toLocaleString()} />
            <Row label="Total purchased" value={(wallet?.totalPurchased ?? 0).toLocaleString()} />
            <Row label="Total consumed" value={(wallet?.totalConsumed ?? 0).toLocaleString()} />
            <Row
              label="Monthly used (wallet)"
              value={(wallet?.monthlyUsed ?? 0).toLocaleString()}
            />
            <Row label="Monthly reset" value={formatDate(wallet?.monthlyResetAt ?? null)} />
            <Row label="Auto top-up" value={org.autoTopUpEnabled ? 'Enabled' : 'Disabled'} />
            <Row label="Auto top-up threshold" value={org.autoTopUpThreshold.toLocaleString()} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Billing Contact</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm sm:grid-cols-3">
          <Row label="Email" value={org.billingEmail ?? '—'} />
          <Row label="Name" value={org.billingName ?? '—'} />
          <Row label="Phone" value={org.billingPhone ?? '—'} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Payment Methods</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 sticky top-0 z-10 border-b">
                  <th className="text-muted-foreground px-4 py-2 text-left font-medium">
                    Provider
                  </th>
                  <th className="text-muted-foreground px-4 py-2 text-left font-medium">Card</th>
                  <th className="text-muted-foreground px-4 py-2 text-left font-medium">Expires</th>
                  <th className="text-muted-foreground px-4 py-2 text-left font-medium">Default</th>
                </tr>
              </thead>
              <tbody>
                {paymentMethods.map((pm) => (
                  <tr
                    key={pm.id}
                    className="hover:bg-muted/40 border-b transition-colors last:border-0"
                  >
                    <td className="px-4 py-2">{pm.provider}</td>
                    <td className="px-4 py-2">
                      {pm.brand && pm.last4 ? `${pm.brand.toUpperCase()} •••• ${pm.last4}` : '—'}
                    </td>
                    <td className="px-4 py-2">
                      {pm.expMonth && pm.expYear ? `${pm.expMonth}/${pm.expYear}` : '—'}
                    </td>
                    <td className="px-4 py-2">
                      {pm.isDefault && <Badge variant="success">Default</Badge>}
                    </td>
                  </tr>
                ))}
                {paymentMethods.length === 0 && (
                  <tr>
                    <td colSpan={4} className="text-muted-foreground px-4 py-6 text-center">
                      No payment methods on file.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Payments</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 sticky top-0 z-10 border-b">
                  <th className="text-muted-foreground px-4 py-2 text-left font-medium">Date</th>
                  <th className="text-muted-foreground px-4 py-2 text-left font-medium">Type</th>
                  <th className="text-muted-foreground px-4 py-2 text-left font-medium">Amount</th>
                  <th className="text-muted-foreground px-4 py-2 text-left font-medium">
                    Provider
                  </th>
                  <th className="text-muted-foreground px-4 py-2 text-left font-medium">Status</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {recentPayments.map((p) => (
                  <tr
                    key={p.id}
                    className="hover:bg-muted/40 border-b transition-colors last:border-0"
                  >
                    <td className="text-muted-foreground px-4 py-2">
                      {formatDateTime(p.createdAt)}
                    </td>
                    <td className="px-4 py-2">{p.type}</td>
                    <td className="px-4 py-2">
                      {p.currency} {Number(p.amount).toLocaleString()}
                    </td>
                    <td className="px-4 py-2">{p.provider}</td>
                    <td className="px-4 py-2">
                      <Badge variant={paymentStatusVariant[p.status]}>{p.status}</Badge>
                    </td>
                    <td className="px-4 py-2">
                      {p.status === 'PENDING' && (
                        <ReconcilePaymentButton orgId={id} paymentId={p.id} />
                      )}
                    </td>
                  </tr>
                ))}
                {recentPayments.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-muted-foreground px-4 py-6 text-center">
                      No payments recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Token Top-Up Orders</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 sticky top-0 z-10 border-b">
                  <th className="text-muted-foreground px-4 py-2 text-left font-medium">Date</th>
                  <th className="text-muted-foreground px-4 py-2 text-left font-medium">Pack</th>
                  <th className="text-muted-foreground px-4 py-2 text-left font-medium">Tokens</th>
                  <th className="text-muted-foreground px-4 py-2 text-left font-medium">Price</th>
                  <th className="text-muted-foreground px-4 py-2 text-left font-medium">Auto</th>
                  <th className="text-muted-foreground px-4 py-2 text-left font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {topUpOrders.map((o) => (
                  <tr
                    key={o.id}
                    className="hover:bg-muted/40 border-b transition-colors last:border-0"
                  >
                    <td className="text-muted-foreground px-4 py-2">
                      {formatDateTime(o.createdAt)}
                    </td>
                    <td className="px-4 py-2">{o.pack.name}</td>
                    <td className="px-4 py-2">{o.tokens.toLocaleString()}</td>
                    <td className="px-4 py-2">${Number(o.priceUsd).toFixed(2)}</td>
                    <td className="px-4 py-2">{o.isAutoTopUp ? 'Yes' : 'No'}</td>
                    <td className="px-4 py-2">
                      <Badge variant={topUpStatusVariant[o.status]}>{o.status}</Badge>
                    </td>
                  </tr>
                ))}
                {topUpOrders.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-muted-foreground px-4 py-6 text-center">
                      No top-up orders yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Invoices</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 sticky top-0 z-10 border-b">
                  <th className="text-muted-foreground px-4 py-2 text-left font-medium">
                    Invoice #
                  </th>
                  <th className="text-muted-foreground px-4 py-2 text-left font-medium">Period</th>
                  <th className="text-muted-foreground px-4 py-2 text-left font-medium">Total</th>
                  <th className="text-muted-foreground px-4 py-2 text-left font-medium">
                    Due date
                  </th>
                  <th className="text-muted-foreground px-4 py-2 text-left font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr
                    key={inv.id}
                    className="hover:bg-muted/40 border-b transition-colors last:border-0"
                  >
                    <td className="px-4 py-2 font-mono">{inv.invoiceNumber}</td>
                    <td className="text-muted-foreground px-4 py-2">
                      {formatDate(inv.periodStart)} – {formatDate(inv.periodEnd)}
                    </td>
                    <td className="px-4 py-2">{formatPkr(Number(inv.totalAmount))}</td>
                    <td className="px-4 py-2">{formatDate(inv.dueDate)}</td>
                    <td className="px-4 py-2">
                      <Badge
                        variant={
                          inv.status === 'PAID'
                            ? 'success'
                            : inv.status === 'OVERDUE'
                              ? 'destructive'
                              : 'secondary'
                        }
                      >
                        {inv.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
                {invoices.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-muted-foreground px-4 py-6 text-center">
                      No invoices issued yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  )
}
