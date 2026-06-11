import type { Organization } from '@prisma/client'
import { PAST_DUE_RESTRICTION_DAYS } from './constants'

// Split out from subscription.ts so it can be imported by src/lib/ai/wallet.ts
// without creating a subscription.ts <-> wallet.ts import cycle
// (subscription.ts imports ensureWalletExists from wallet.ts).

export function daysSince(date: Date | null, now: Date = new Date()): number | null {
  if (!date) return null
  return Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
}

/** AI features / exports disabled — PAST_DUE for >= 7 days, or SUSPENDED/CANCELLED. */
export function isFeatureRestricted(org: Pick<Organization, 'status' | 'pastDueAt'>): boolean {
  if (org.status === 'SUSPENDED' || org.status === 'CANCELLED') return true
  if (org.status === 'PAST_DUE') {
    const d = daysSince(org.pastDueAt)
    return d !== null && d >= PAST_DUE_RESTRICTION_DAYS
  }
  return false
}

/** Account is read-only — only the billing page should allow writes. */
export function isReadOnly(org: Pick<Organization, 'status'>): boolean {
  return org.status === 'SUSPENDED' || org.status === 'CANCELLED'
}
