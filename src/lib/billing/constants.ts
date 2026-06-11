// Phase 6 platform billing constants — derived from Prima_Pricing_Strategy.md

export const TRIAL_DAYS = 14
export const SETUP_FEE_DEFAULT = 20000 // PKR
export const ANNUAL_BILLING_MONTHS = 12
export const ANNUAL_PRICE_MONTHS = 10 // 12 months for the price of 10 (~17% off)

// Subscription lifecycle (days since `pastDueAt`)
export const PAST_DUE_RESTRICTION_DAYS = 7 // AI + exports disabled
export const PAST_DUE_SUSPEND_DAYS = 14 // account becomes read-only (SUSPENDED)

// Days after `suspendedAt` before data is eligible for deletion
export const SUSPENDED_GRACE_PERIOD_DAYS = 30
// Days after `suspendedAt` at which data deletion actually runs
export const SUSPENDED_DELETE_AFTER_DAYS = 90

// Trial conversion reminder days-before-expiry
export const TRIAL_REMINDER_DAYS = [7, 3, 1, 0]

// Default token top-up pack name used for auto-top-up when an org hasn't
// picked one explicitly.
export const DEFAULT_AUTO_TOPUP_PACK_NAME = 'Standard'
