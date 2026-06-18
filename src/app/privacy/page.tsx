import type { Metadata } from 'next'
import { SiteHeader } from '@/components/marketing/site-header'
import { SiteFooter } from '@/components/marketing/site-footer'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'How Prima collects, uses, and protects your data.',
}

const LAST_UPDATED = '18 June 2026'

export default function PrivacyPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />

      <main id="main-content" className="py-16 sm:py-20">
        <div className="prose-content mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <h1 className="text-foreground text-4xl font-bold tracking-tight">Privacy Policy</h1>
          <p className="text-muted-foreground mt-3 text-sm">Last updated: {LAST_UPDATED}</p>

          <div className="text-foreground [&_h2]:text-foreground [&_p]:text-muted-foreground [&_li]:text-muted-foreground mt-10 space-y-8 text-sm leading-relaxed [&_h2]:mt-10 [&_h2]:text-xl [&_h2]:font-semibold [&_p]:mt-3">
            <p className="text-muted-foreground">
              This policy explains how Prima (&ldquo;we&rdquo;, &ldquo;us&rdquo;) collects, uses,
              and protects information when an organization (&ldquo;you&rdquo;, a
              &ldquo;tenant&rdquo;) uses our daily sales reporting platform. It applies to account
              data, business records you upload to Prima, and data collected through our marketing
              site.
            </p>

            <section>
              <h2>1. What we collect</h2>
              <p>
                Account data: name, work email, password hash, and role within your organization.
              </p>
              <p>
                Business records you submit: distributor, client, and product information; sales
                reports; invoices and payment records; and, where applicable, financial identifiers
                such as NTN/STRN numbers, bank account numbers, and IBANs needed for invoicing.
              </p>
              <p>
                Usage data: pages visited and product interactions, collected through PostHog when
                analytics are enabled for your organization.
              </p>
              <p>
                AI interaction data: prompts and context sent to your configured AI provider
                (Claude, OpenAI, Gemini, or a self-hosted Ollama instance) when you use the AI
                assistant or AI insight features.
              </p>
            </section>

            <section>
              <h2>2. How we use it</h2>
              <ul className="ml-5 list-disc space-y-2">
                <li>To operate the core product: dashboards, reports, invoicing, and approvals.</li>
                <li>
                  To power AI features, using only the data your organization has stored in Prima.
                </li>
                <li>
                  To send transactional email: invites, password resets, invoices, and billing
                  notices.
                </li>
                <li>
                  To monitor system health and investigate errors, with tenant context attached so
                  we can resolve issues quickly.
                </li>
              </ul>
            </section>

            <section>
              <h2>3. Sensitive financial fields</h2>
              <p>
                NTN/STRN numbers, bank account numbers, and IBANs are encrypted at rest using
                AES-256-GCM before they are written to our database. They are decrypted only when
                needed to render an invoice or process a payment.
              </p>
            </section>

            <section>
              <h2>4. Sub-processors</h2>
              <p>
                We rely on a small number of infrastructure providers to operate Prima: Neon
                (PostgreSQL hosting), Upstash (Redis, rate limiting), Cloudflare R2 (file storage),
                Resend (transactional email), Stripe (payments), Sentry (error monitoring), PostHog
                (product analytics), and your organization&apos;s chosen AI provider (Anthropic,
                OpenAI, Google, or a self-hosted Ollama endpoint you control).
              </p>
            </section>

            <section>
              <h2>5. Tenant isolation</h2>
              <p>
                Prima is multi-tenant. Every database query is scoped to your organization at the
                application layer, and cross-tenant access is covered by our automated test suite.
                No tenant can read or write another tenant&apos;s data through normal product use.
              </p>
            </section>

            <section>
              <h2>6. Data retention and deletion</h2>
              <p>
                We retain your data for as long as your account is active. If you close your
                account, you may request export or deletion of your organization&apos;s data by
                contacting us; we will complete deletion requests within 30 days, subject to backup
                retention for disaster recovery (see our backup policy).
              </p>
            </section>

            <section>
              <h2>7. Your rights</h2>
              <p>
                You may request a copy of the personal data we hold about you, request corrections,
                or request deletion, by contacting us at the address below.
              </p>
            </section>

            <section>
              <h2>8. Contact</h2>
              <p>
                Questions about this policy can be sent to <strong>privacy@prima.app</strong>.
              </p>
            </section>

            <p className="text-muted-foreground mt-10 text-xs">
              This policy is a working draft maintained by our engineering team and has not yet been
              reviewed by legal counsel. It will be finalized before public launch.
            </p>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}
