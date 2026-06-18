import type { Metadata } from 'next'
import Link from 'next/link'
import { PlayCircle } from 'lucide-react'
import { SiteHeader } from '@/components/marketing/site-header'
import { SiteFooter } from '@/components/marketing/site-footer'
import { FaqAccordion } from '@/components/marketing/faq-accordion'

export const metadata: Metadata = {
  title: 'Documentation',
  description: 'Getting started with Prima, feature guides, the REST API reference, and FAQ.',
}

const SECTIONS = [
  { href: '#getting-started', label: 'Getting started' },
  { href: '#guides', label: 'Feature guides' },
  { href: '#api', label: 'API reference' },
  { href: '#faq', label: 'FAQ' },
]

const GETTING_STARTED_STEPS = [
  {
    title: 'Accept your invite',
    body: 'A super admin creates your organization and sends an invite link to the admin email. Follow the link to set your password and sign in.',
  },
  {
    title: 'Import your data',
    body: 'From Admin > Clients or Admin > Distributors, use Import to bulk-upload from a spreadsheet (.csv or .xlsx). Map your columns once; Prima remembers the mapping for future imports.',
  },
  {
    title: 'Invite your team',
    body: 'Add sales reps, managers, and finance users from Admin > Users. Assign roles and departments so dashboards and approvals route to the right people.',
  },
  {
    title: 'Submit your first DSR',
    body: 'Sales reps log in and submit a daily sales report from the dashboard. Managers see it appear in their approval queue immediately.',
  },
  {
    title: 'Turn on AI (Pro and above)',
    body: 'From Admin > Settings > AI, connect a provider (Claude, OpenAI, Gemini, or a self-hosted Ollama endpoint) and start asking the assistant questions about your business.',
  },
]

const GUIDES = [
  {
    title: 'Daily sales reporting',
    body: 'How reps submit reports, how managers review and approve them, and how exceptions get flagged.',
  },
  {
    title: 'Dashboards',
    body: 'Customizing your dashboard with drag-and-drop widgets, and what each of the 11 role-specific dashboards shows.',
  },
  {
    title: 'Invoicing and payments',
    body: 'Creating invoice templates, issuing invoices, recording payments, and automated overdue reminders.',
  },
  {
    title: 'AI assistant',
    body: 'Asking questions about clients, inventory, and payments, and how Prima grounds answers in your own data.',
  },
  {
    title: 'Inventory management',
    body: 'Tracking stock across warehouses, recording transfers and adjustments, and reading demand predictions.',
  },
  {
    title: 'Team and permissions',
    body: 'Roles, departments, granular permissions, and the audit log.',
  },
]

const API_GROUPS = [
  {
    resource: 'DSR (daily sales reports)',
    base: '/api/v1/dsr',
    endpoints: [
      'GET /dsr - list reports for your organization',
      'POST /dsr - create a draft report',
      'GET /dsr/{id} - fetch a single report',
      'PUT /dsr/{id} - update a draft report',
      'POST /dsr/{id}/submit - submit for approval',
      'POST /dsr/{id}/approve - approve (manager role)',
      'POST /dsr/{id}/reject - reject with a reason (manager role)',
    ],
  },
  {
    resource: 'Clients & distributors',
    base: '/api/v1/clients, /api/v1/distributors',
    endpoints: [
      'GET/POST /clients, /distributors - list or create',
      'GET/PATCH/DELETE /clients/{id}, /distributors/{id}',
      'POST /clients/import, /distributors/import - bulk import from .csv/.xlsx',
      'GET /clients/{id}/payments - payment history for a client',
    ],
  },
  {
    resource: 'Products & inventory',
    base: '/api/v1/products, /api/v1/inventory, /api/v1/warehouses',
    endpoints: [
      'GET/POST /products - list or create products',
      'GET /inventory/stock - current stock levels',
      'POST /inventory/transfer - move stock between warehouses',
      'POST /inventory/adjust - record a manual stock adjustment',
      'POST /inventory/stock-take - reconcile a physical count',
    ],
  },
  {
    resource: 'Invoicing & payments',
    base: '/api/v1/invoices, /api/v1/invoice-templates',
    endpoints: [
      'GET/POST /invoices - list or create invoices',
      'POST /invoices/{id}/issue - issue a draft invoice',
      'POST /invoices/{id}/payments - record a payment',
      'GET /invoices/{id}/pdf - download the invoice PDF',
      'POST /invoices/{id}/send - email the invoice to the client',
    ],
  },
  {
    resource: 'Dashboards',
    base: '/api/v1/dashboards/*',
    endpoints: [
      'GET /dashboards/sales, /financial, /inventory, /executive, /epr, /manager, /rep, /clients, /distributors',
      'Each returns the aggregated, cached dataset for that role-specific dashboard.',
    ],
  },
  {
    resource: 'AI',
    base: '/api/v1/ai/*',
    endpoints: [
      'POST /ai/chat - send a message to the AI assistant',
      'GET /ai/recommendations - AI-generated recommendations for your organization',
      'GET /ai/usage - current AI token usage for the billing period',
    ],
  },
  {
    resource: 'Billing',
    base: '/api/v1/billing/*',
    endpoints: [
      'GET /billing/overview - subscription, usage, and trial status',
      'GET /billing/plans - available plan tiers',
      'POST /billing/subscribe, /billing/change-plan - manage your subscription',
      'GET/POST /billing/payment-methods - manage saved cards',
    ],
  },
]

const DOCS_FAQ = [
  {
    question: 'How do I authenticate API requests?',
    answer:
      'All /api/v1 routes require an authenticated session cookie from the web app. A dedicated API-key flow for server-to-server integrations is planned but not yet available.',
  },
  {
    question: 'Is there a sandbox or staging environment?',
    answer:
      'Each organization gets its own isolated tenant, so you can safely test imports and workflows in your own account before relying on them for daily operations.',
  },
  {
    question: 'Where do I report a bug?',
    answer: 'Email support@prima.app with a description and, if possible, a screenshot.',
  },
]

export default function DocsPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />

      <main id="main-content" className="py-16 sm:py-20">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <h1 className="text-foreground text-4xl font-bold tracking-tight sm:text-5xl">
            Documentation.
          </h1>
          <p className="text-muted-foreground mt-5 text-lg leading-relaxed">
            Everything you need to get your team up and running on Prima.
          </p>

          <nav className="border-border bg-card mt-8 flex flex-wrap gap-2 rounded-md border p-3">
            {SECTIONS.map((s) => (
              <Link
                key={s.href}
                href={s.href}
                className="text-muted-foreground hover:text-foreground hover:bg-muted rounded-md px-3 py-1.5 text-sm font-medium transition-colors"
              >
                {s.label}
              </Link>
            ))}
          </nav>
        </div>

        <section id="getting-started" className="mx-auto mt-20 max-w-3xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-foreground text-2xl font-bold tracking-tight">Getting started</h2>
          <ol className="mt-8 space-y-6">
            {GETTING_STARTED_STEPS.map((step, i) => (
              <li key={step.title} className="flex gap-4">
                <span className="bg-accent text-accent-foreground flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-mono text-sm font-semibold">
                  {i + 1}
                </span>
                <div>
                  <h3 className="text-foreground text-base font-semibold">{step.title}</h3>
                  <p className="text-muted-foreground mt-1 text-sm leading-relaxed">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section id="guides" className="mx-auto mt-20 max-w-5xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-foreground text-2xl font-bold tracking-tight">Feature guides</h2>
          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2">
            {GUIDES.map((guide) => (
              <div key={guide.title} className="border-border bg-card rounded-md border p-5">
                <div className="bg-muted flex aspect-video items-center justify-center rounded-md">
                  <PlayCircle className="text-muted-foreground h-10 w-10" />
                </div>
                <h3 className="text-foreground mt-4 text-base font-semibold">{guide.title}</h3>
                <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">{guide.body}</p>
                <p className="text-muted-foreground mt-3 text-xs">Walkthrough video coming soon</p>
              </div>
            ))}
          </div>
        </section>

        <section id="api" className="mx-auto mt-20 max-w-3xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-foreground text-2xl font-bold tracking-tight">API reference</h2>
          <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
            Prima exposes a REST API under <code className="font-mono">/api/v1</code>. Every request
            is scoped to your organization automatically based on your session, every input is
            validated, and every route is rate-limited.
          </p>

          <div className="mt-8 space-y-8">
            {API_GROUPS.map((group) => (
              <div key={group.resource}>
                <h3 className="text-foreground text-base font-semibold">{group.resource}</h3>
                <p className="text-muted-foreground mt-1 font-mono text-xs">{group.base}</p>
                <ul className="mt-3 space-y-1.5">
                  {group.endpoints.map((line) => (
                    <li
                      key={line}
                      className="text-muted-foreground font-mono text-xs leading-relaxed"
                    >
                      {line}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <p className="text-muted-foreground mt-10 text-xs">
            A full OpenAPI specification generated automatically from our Zod request schemas is on
            the roadmap. This reference is maintained by hand in the meantime.
          </p>
        </section>

        <section id="faq" className="mx-auto mt-20 max-w-3xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-foreground text-2xl font-bold tracking-tight">FAQ</h2>
          <div className="mt-8">
            <FaqAccordion items={DOCS_FAQ} />
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}
