import { prisma } from '@/lib/prisma'
import {
  chargeSubscriptionRenewal,
  markPastDue,
  markSuspended,
  daysSince,
} from '@/lib/billing/subscription'
import {
  PAST_DUE_RESTRICTION_DAYS,
  PAST_DUE_SUSPEND_DAYS,
  SUSPENDED_GRACE_PERIOD_DAYS,
  SUSPENDED_DELETE_AFTER_DAYS,
  TRIAL_REMINDER_DAYS,
} from '@/lib/billing/constants'
import {
  sendTrialEndingEmail,
  sendPaymentFailedEmail,
  sendFeatureRestrictedEmail,
  sendSuspendedEmail,
  sendGracePeriodReminderEmail,
} from '@/lib/email'
import type { Organization, OrgStatus } from '@prisma/client'

const DAY_MS = 24 * 60 * 60 * 1000

type LifecycleOrg = Pick<
  Organization,
  | 'id'
  | 'name'
  | 'email'
  | 'billingEmail'
  | 'status'
  | 'plan'
  | 'billingCycle'
  | 'monthlyPrice'
  | 'trialEndsAt'
  | 'nextBillingDate'
  | 'pastDueAt'
  | 'suspendedAt'
  | 'gracePeriodEndsAt'
>

function billingContact(org: Pick<Organization, 'email' | 'billingEmail'>): string {
  return org.billingEmail ?? org.email
}

function renewalAmount(org: Pick<Organization, 'billingCycle' | 'monthlyPrice'>): number {
  return org.billingCycle === 'ANNUAL'
    ? Math.round(Number(org.monthlyPrice) * 12)
    : Number(org.monthlyPrice)
}

/** Sends trial-ending reminders at 7/3/1/0 days, and suspends if the trial has lapsed. */
async function processTrialOrg(org: LifecycleOrg, now: Date): Promise<void> {
  if (!org.trialEndsAt) return

  const daysRemaining = Math.ceil((org.trialEndsAt.getTime() - now.getTime()) / DAY_MS)

  if (daysRemaining < 0) {
    await markSuspended(org.id)
    await sendSuspendedEmail({
      to: billingContact(org),
      orgName: org.name,
      gracePeriodEndsAt: new Date(now.getTime() + SUSPENDED_GRACE_PERIOD_DAYS * DAY_MS),
    }).catch((err) => console.error('[subscription-lifecycle] suspended email failed', org.id, err))
    return
  }

  if ((TRIAL_REMINDER_DAYS as readonly number[]).includes(daysRemaining)) {
    await sendTrialEndingEmail({ to: billingContact(org), orgName: org.name, daysRemaining }).catch(
      (err) => console.error('[subscription-lifecycle] trial reminder failed', org.id, err)
    )
  }
}

/**
 * For ACTIVE/PAST_DUE orgs: charges the renewal once `nextBillingDate` has
 * passed (retried daily for PAST_DUE orgs since the date won't advance until
 * a charge succeeds), then escalates PAST_DUE orgs through the restriction
 * and suspension thresholds.
 */
async function processBillableOrg(org: LifecycleOrg, now: Date): Promise<void> {
  if (org.nextBillingDate && org.nextBillingDate <= now) {
    const result = await chargeSubscriptionRenewal(org.id)
    if (result.status === 'SUCCEEDED') return

    if (org.status === 'ACTIVE') {
      await markPastDue(org.id)
      await sendPaymentFailedEmail({
        to: billingContact(org),
        orgName: org.name,
        amount: renewalAmount(org),
        reason: result.error,
      }).catch((err) =>
        console.error('[subscription-lifecycle] payment-failed email failed', org.id, err)
      )
    }
    return
  }

  if (org.status === 'PAST_DUE') {
    const days = daysSince(org.pastDueAt, now) ?? 0

    if (days === PAST_DUE_SUSPEND_DAYS) {
      await markSuspended(org.id)
      await sendSuspendedEmail({
        to: billingContact(org),
        orgName: org.name,
        gracePeriodEndsAt: new Date(now.getTime() + SUSPENDED_GRACE_PERIOD_DAYS * DAY_MS),
      }).catch((err) =>
        console.error('[subscription-lifecycle] suspended email failed', org.id, err)
      )
    } else if (days === PAST_DUE_RESTRICTION_DAYS) {
      await sendFeatureRestrictedEmail({ to: billingContact(org), orgName: org.name }).catch(
        (err) => console.error('[subscription-lifecycle] restriction email failed', org.id, err)
      )
    }
  }
}

/**
 * Sends daily reminders during the 30-day grace period after suspension.
 * Actual data export + deletion at day 90 is out of scope for this phase
 * (see Phase 6 deviations) — only reminder emails are sent here.
 */
async function processSuspendedOrg(org: LifecycleOrg, now: Date): Promise<void> {
  if (!org.suspendedAt || !org.gracePeriodEndsAt) return

  const daysRemaining = Math.ceil((org.gracePeriodEndsAt.getTime() - now.getTime()) / DAY_MS)
  if (daysRemaining < 0) return

  const deleteAt = new Date(org.suspendedAt.getTime() + SUSPENDED_DELETE_AFTER_DAYS * DAY_MS)
  await sendGracePeriodReminderEmail({
    to: billingContact(org),
    orgName: org.name,
    daysRemaining,
    deleteAt,
  }).catch((err) =>
    console.error('[subscription-lifecycle] grace-period reminder failed', org.id, err)
  )
}

const ACTIVE_STATUSES: OrgStatus[] = ['TRIAL', 'ACTIVE', 'PAST_DUE', 'SUSPENDED']

/** Daily subscription lifecycle pass across every non-cancelled org. */
export async function runSubscriptionLifecycle(): Promise<void> {
  const orgs = await prisma.organization.findMany({
    where: { deletedAt: null, status: { in: ACTIVE_STATUSES } },
    select: {
      id: true,
      name: true,
      email: true,
      billingEmail: true,
      status: true,
      plan: true,
      billingCycle: true,
      monthlyPrice: true,
      trialEndsAt: true,
      nextBillingDate: true,
      pastDueAt: true,
      suspendedAt: true,
      gracePeriodEndsAt: true,
    },
  })

  const now = new Date()

  for (const org of orgs) {
    try {
      if (org.status === 'TRIAL') await processTrialOrg(org, now)
      else if (org.status === 'SUSPENDED') await processSuspendedOrg(org, now)
      else await processBillableOrg(org, now)
    } catch (err) {
      console.error(`[subscription-lifecycle] org ${org.id} failed:`, err)
    }
  }
}
