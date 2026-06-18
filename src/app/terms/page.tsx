import type { Metadata } from 'next'
import { SiteHeader } from '@/components/marketing/site-header'
import { SiteFooter } from '@/components/marketing/site-footer'

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'The terms that govern your use of Prima.',
}

const LAST_UPDATED = '18 June 2026'

export default function TermsPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />

      <main id="main-content" className="py-16 sm:py-20">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <h1 className="text-foreground text-4xl font-bold tracking-tight">Terms of Service</h1>
          <p className="text-muted-foreground mt-3 text-sm">Last updated: {LAST_UPDATED}</p>

          <div className="mt-10 space-y-8 text-sm leading-relaxed">
            <section>
              <h2 className="text-foreground text-xl font-semibold">1. Agreement</h2>
              <p className="text-muted-foreground mt-3">
                By creating an organization account on Prima, you agree to these terms on behalf of
                your business. If you do not agree, do not use the service.
              </p>
            </section>

            <section>
              <h2 className="text-foreground text-xl font-semibold">2. Subscription and billing</h2>
              <ul className="text-muted-foreground mt-3 ml-5 list-disc space-y-2">
                <li>
                  Plans are billed monthly or annually in advance, in Pakistani Rupees (PKR), as
                  described on our pricing page.
                </li>
                <li>
                  A one-time setup fee applies to Starter, Pro, and Business plans unless waived
                  under an active promotion.
                </li>
                <li>
                  AI token allowances reset at the start of each billing cycle and do not roll over.
                </li>
                <li>
                  You may cancel at any time. Access continues until the end of the period already
                  paid for.
                </li>
                <li>
                  Accounts that fall past due enter a grace period before features are restricted,
                  then suspended, as described in your billing dashboard.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-foreground text-xl font-semibold">3. Your data</h2>
              <p className="text-muted-foreground mt-3">
                You retain ownership of the business data you submit to Prima: clients,
                distributors, products, sales reports, and invoices. We process this data only to
                provide the service to you, as described in our Privacy Policy.
              </p>
            </section>

            <section>
              <h2 className="text-foreground text-xl font-semibold">4. Acceptable use</h2>
              <p className="text-muted-foreground mt-3">
                You agree not to use Prima to store data you do not have the right to process,
                attempt to access another organization&apos;s data, or interfere with the security
                or availability of the service.
              </p>
            </section>

            <section>
              <h2 className="text-foreground text-xl font-semibold">5. Service availability</h2>
              <p className="text-muted-foreground mt-3">
                We aim for high availability but do not guarantee uninterrupted service except where
                a specific uptime SLA is included in your plan (Enterprise plans only). We perform
                daily backups and document a tested restore procedure.
              </p>
            </section>

            <section>
              <h2 className="text-foreground text-xl font-semibold">6. Limitation of liability</h2>
              <p className="text-muted-foreground mt-3">
                Prima is provided on an &ldquo;as is&rdquo; basis. To the maximum extent permitted
                by law, we are not liable for indirect, incidental, or consequential damages arising
                from your use of the service.
              </p>
            </section>

            <section>
              <h2 className="text-foreground text-xl font-semibold">7. Changes to these terms</h2>
              <p className="text-muted-foreground mt-3">
                We may update these terms from time to time. We will notify active organizations of
                material changes by email before they take effect.
              </p>
            </section>

            <section>
              <h2 className="text-foreground text-xl font-semibold">8. Contact</h2>
              <p className="text-muted-foreground mt-3">
                Questions about these terms can be sent to{' '}
                <strong className="text-foreground">legal@prima.app</strong>.
              </p>
            </section>

            <p className="text-muted-foreground mt-10 text-xs">
              This is a working draft maintained by our engineering team and has not yet been
              reviewed by legal counsel. It will be finalized before public launch.
            </p>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}
