import { getRequestConfig } from 'next-intl/server'
import { defaultLocale } from './locales'

// Locale is a static constant (not read from cookies/headers) so pages keep
// their static-generation eligibility — `next build` prerenders public pages
// (login, marketing site, etc.) as static HTML, which matters for Lighthouse
// and TTI. A per-request language switcher needs next-intl's `[locale]`
// segment routing (locale resolved from the URL, known at build time), which
// is a bigger structural change deferred past this foundation pass — see
// docs/i18n.md.
export default getRequestConfig(async () => {
  const locale = defaultLocale

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  }
})
