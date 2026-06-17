import type { Metadata } from 'next'
import { Plus_Jakarta_Sans } from 'next/font/google'
import { NextIntlClientProvider } from 'next-intl'
import { getLocale, getMessages } from 'next-intl/server'
import './globals.css'
import { ThemeProvider } from '@/components/layout/theme-provider'
import { Toaster } from 'sonner'
import { DevAutoFill } from '@/components/dev-autofill'
import { isRtlLocale } from '@/i18n/locales'

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  weight: ['300', '400', '500', '600', '700'],
})

export const metadata: Metadata = {
  title: { default: 'Prima', template: '%s | Prima' },
  description: 'Intelligent multi-tenant Daily Sales Reporting platform',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale()
  const messages = await getMessages()

  return (
    <html
      lang={locale}
      dir={isRtlLocale(locale) ? 'rtl' : 'ltr'}
      suppressHydrationWarning
      className={plusJakartaSans.variable}
    >
      <body className="bg-background min-h-screen font-sans antialiased">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            {children}
            <Toaster richColors position="top-right" />
            <DevAutoFill />
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
