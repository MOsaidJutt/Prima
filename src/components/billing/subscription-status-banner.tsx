import Link from 'next/link'
import { AlertTriangle, Ban, Clock, XCircle } from 'lucide-react'
import type { Organization } from '@prisma/client'
import { cn } from '@/lib/utils'
import { daysSince, isFeatureRestricted } from '@/lib/billing/status'
import {
  PAST_DUE_RESTRICTION_DAYS,
  PAST_DUE_SUSPEND_DAYS,
  TRIAL_REMINDER_DAYS,
} from '@/lib/billing/constants'

const DAY_MS = 24 * 60 * 60 * 1000

type BannerOrg = Pick<Organization, 'status' | 'trialEndsAt' | 'pastDueAt' | 'gracePeriodEndsAt'>

const TONE_CLASSES = {
  destructive: 'border-destructive/20 bg-destructive/10 text-destructive',
  warning: 'border-warning/20 bg-warning/10 text-warning',
  info: 'border-info/20 bg-info/10 text-info',
} as const

function Banner({
  tone,
  icon,
  children,
}: {
  tone: keyof typeof TONE_CLASSES
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div
      className={cn(
        'mb-4 flex items-start gap-2 rounded-lg border px-4 py-3 text-sm',
        TONE_CLASSES[tone]
      )}
    >
      <span className="mt-0.5 shrink-0">{icon}</span>
      <p>{children}</p>
    </div>
  )
}

/**
 * Phase 6 subscription lifecycle banner — shown at the top of every tenant
 * page. Reflects the org's *current* DB status (not the JWT-cached one).
 */
export function SubscriptionStatusBanner({
  org,
  billingHref = '/admin/billing',
}: {
  org: BannerOrg
  billingHref?: string
}) {
  const now = new Date()

  if (org.status === 'CANCELLED') {
    return (
      <Banner tone="destructive" icon={<XCircle className="h-4 w-4" />}>
        Your Prima subscription has been cancelled.{' '}
        <Link href={billingHref} className="font-medium underline">
          Reactivate billing
        </Link>{' '}
        to restore access.
      </Banner>
    )
  }

  if (org.status === 'SUSPENDED') {
    const daysLeft = org.gracePeriodEndsAt
      ? Math.max(0, Math.ceil((org.gracePeriodEndsAt.getTime() - now.getTime()) / DAY_MS))
      : null
    return (
      <Banner tone="destructive" icon={<Ban className="h-4 w-4" />}>
        Your account is suspended due to non-payment. You have read-only access and AI features are
        disabled
        {daysLeft !== null &&
          ` — your data will be retained for ${daysLeft} more day${daysLeft === 1 ? '' : 's'}`}
        .{' '}
        <Link href={billingHref} className="font-medium underline">
          Resolve billing
        </Link>{' '}
        to restore full access.
      </Banner>
    )
  }

  if (org.status === 'PAST_DUE') {
    const days = daysSince(org.pastDueAt) ?? 0
    const restricted = isFeatureRestricted(org)
    const daysUntilSuspend = Math.max(0, PAST_DUE_SUSPEND_DAYS - days)

    return (
      <Banner tone="warning" icon={<AlertTriangle className="h-4 w-4" />}>
        We were unable to process your last payment.{' '}
        {restricted
          ? 'AI features are currently disabled until payment is resolved.'
          : `Please update your payment method within ${Math.max(0, PAST_DUE_RESTRICTION_DAYS - days)} day(s) to avoid AI features being restricted.`}{' '}
        Your account will be suspended in {daysUntilSuspend} day{daysUntilSuspend === 1 ? '' : 's'}{' '}
        if unresolved.{' '}
        <Link href={billingHref} className="font-medium underline">
          Update payment method
        </Link>
      </Banner>
    )
  }

  if (org.status === 'TRIAL' && org.trialEndsAt) {
    const daysLeft = Math.ceil((org.trialEndsAt.getTime() - now.getTime()) / DAY_MS)
    if (daysLeft < 0 || (daysLeft > 7 && !TRIAL_REMINDER_DAYS.includes(daysLeft))) return null

    return (
      <Banner tone="info" icon={<Clock className="h-4 w-4" />}>
        {daysLeft <= 0
          ? 'Your free trial ends today.'
          : `Your free trial ends in ${daysLeft} day${daysLeft === 1 ? '' : 's'}.`}{' '}
        <Link href={billingHref} className="font-medium underline">
          Upgrade now
        </Link>{' '}
        to keep using Prima without interruption.
      </Banner>
    )
  }

  return null
}
