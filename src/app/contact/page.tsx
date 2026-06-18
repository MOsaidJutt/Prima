import type { Metadata } from 'next'
import { Suspense } from 'react'
import { Mail, Clock } from 'lucide-react'
import { SiteHeader } from '@/components/marketing/site-header'
import { SiteFooter } from '@/components/marketing/site-footer'
import { ContactForm } from '@/components/marketing/contact-form'

export const metadata: Metadata = {
  title: 'Contact',
  description: 'Talk to the Prima team about a free trial, pricing, or a custom Enterprise plan.',
}

export default function ContactPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />

      <main id="main-content" className="py-16 sm:py-20">
        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-16 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
          <div>
            <h1 className="text-foreground text-4xl font-bold tracking-tight sm:text-5xl">
              Let&apos;s talk about your business.
            </h1>
            <p className="text-muted-foreground mt-6 max-w-md text-lg leading-relaxed">
              Tell us a bit about your team and we will help you pick the right plan, or get your
              free trial started.
            </p>

            <div className="mt-10 space-y-5">
              <div className="flex items-center gap-3">
                <Mail className="text-accent h-5 w-5" />
                <span className="text-foreground text-sm">sales@prima.app</span>
              </div>
              <div className="flex items-center gap-3">
                <Clock className="text-accent h-5 w-5" />
                <span className="text-foreground text-sm">We reply within one business day</span>
              </div>
            </div>
          </div>

          <div className="border-border bg-card rounded-md border p-6 sm:p-8">
            <Suspense fallback={null}>
              <ContactForm />
            </Suspense>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}
