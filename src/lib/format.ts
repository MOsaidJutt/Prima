// Locale-aware currency/date/number formatting, keyed off the org's own
// locale/currency/timezone (Organization.locale/currency/timezone in
// schema.prisma — set at onboarding, editable in Settings > Organization).
// Phase 7 i18n foundation: centralizes formatting so adding a new locale
// (e.g. Urdu) only requires updating org settings, not call sites.

export type OrgLocaleSettings = {
  locale: string
  currency: string
  timezone: string
}

export const DEFAULT_ORG_LOCALE: OrgLocaleSettings = {
  locale: 'en-PK',
  currency: 'PKR',
  timezone: 'Asia/Karachi',
}

export function formatCurrency(
  amount: number | string,
  org: OrgLocaleSettings = DEFAULT_ORG_LOCALE
) {
  const n = typeof amount === 'string' ? Number(amount) : amount
  try {
    return new Intl.NumberFormat(org.locale, {
      style: 'currency',
      currency: org.currency,
      minimumFractionDigits: 2,
    }).format(n)
  } catch {
    // Unknown currency code (e.g. a custom/unlisted one) — fall back to a
    // plain prefix rather than throwing in a PDF/email render path.
    return `${org.currency} ${n.toLocaleString(org.locale, { minimumFractionDigits: 2 })}`
  }
}

export function formatNumber(n: number, org: OrgLocaleSettings = DEFAULT_ORG_LOCALE) {
  return new Intl.NumberFormat(org.locale).format(n)
}

export function formatDate(date: Date | string, org: OrgLocaleSettings = DEFAULT_ORG_LOCALE) {
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat(org.locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: org.timezone,
  }).format(d)
}

export function formatDateTime(date: Date | string, org: OrgLocaleSettings = DEFAULT_ORG_LOCALE) {
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat(org.locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: org.timezone,
  }).format(d)
}
