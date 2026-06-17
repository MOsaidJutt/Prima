// Phase 7 i18n foundation. Prima's URL space is already used for tenant
// subdomain routing (see src/middleware.ts), so locale is NOT part of the
// URL — it's resolved from a cookie (user override) with English as the
// always-available default. Adding a language only requires a new
// messages/<locale>.json file; no routing changes.
export const locales = ['en', 'ur'] as const
export type Locale = (typeof locales)[number]

export const defaultLocale: Locale = 'en'

export const localeNames: Record<Locale, string> = {
  en: 'English',
  ur: 'اردو',
}

const rtlLocales: ReadonlySet<Locale> = new Set(['ur'])

export function isRtlLocale(locale: string): boolean {
  return rtlLocales.has(locale as Locale)
}

export function isSupportedLocale(value: string | undefined): value is Locale {
  return !!value && (locales as readonly string[]).includes(value)
}
