import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import {
  ClipboardCheck,
  LayoutDashboard,
  Sparkles,
  Boxes,
  FileText,
  Users,
  ShieldCheck,
  Globe2,
  ArrowRight,
  Send,
  CheckCircle2,
  BarChart3,
  Check,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SiteHeader } from '@/components/marketing/site-header'
import { SiteFooter } from '@/components/marketing/site-footer'
import { Reveal } from '@/components/marketing/reveal'
import { HeroPreview } from '@/components/marketing/hero-preview'
import { AiChatPreview } from '@/components/marketing/ai-chat-preview'
import { PricingTable } from '@/components/marketing/pricing-table'
import { FaqAccordion } from '@/components/marketing/faq-accordion'

export const metadata: Metadata = {
  title: 'Prima: Daily Sales Reporting & AI Insights for Distribution Teams',
  description:
    'Replace scattered DSR sheets and WhatsApp updates with one real-time view of sales, inventory, and risk. Built for distribution businesses in Pakistan.',
  openGraph: {
    title: 'Prima: From raw data to refined decisions',
    description:
      'Daily sales reporting, 11 role-specific dashboards, and AI insights for distribution teams.',
    type: 'website',
    siteName: 'Prima',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Prima: From raw data to refined decisions',
    description: 'Daily sales reporting and AI insights for distribution teams.',
  },
}

const FEATURES = [
  {
    icon: ClipboardCheck,
    title: 'Daily sales reporting',
    body: 'Reps submit daily reports in minutes. Managers review, approve, and flag exceptions in one queue.',
    large: false,
  },
  {
    icon: LayoutDashboard,
    title: 'Role-specific dashboards',
    body: 'Sales, financial, inventory, and executive views, each customizable with drag-and-drop widgets.',
    large: false,
    stat: '11',
  },
  {
    icon: Sparkles,
    title: 'AI assistant',
    body: 'Ask questions about clients, inventory, and payments in plain language and get answers grounded in your real data.',
    large: true,
    preview: 'ai',
  },
  {
    icon: Boxes,
    title: 'Inventory intelligence',
    body: 'Demand prediction, dormant-client detection, and anomaly alerts watch your business while you sleep.',
    large: true,
    preview: 'inventory',
  },
  {
    icon: FileText,
    title: 'Invoicing & payments',
    body: 'Branded invoice templates, payment tracking, and automated overdue reminders.',
    large: false,
  },
  {
    icon: Users,
    title: 'Team management',
    body: 'Roles, departments, granular permissions, and a full audit log for every change.',
    large: false,
  },
  {
    icon: ShieldCheck,
    title: 'Built for trust',
    body: null,
    large: false,
    checklist: [
      'Tenant isolation on every query',
      'PII encrypted at rest',
      'Rate limiting on every route',
    ],
  },
  {
    icon: Globe2,
    title: 'Built for Pakistan',
    body: 'PKR-native billing, local currency formatting, and Urdu support on the roadmap.',
    large: false,
  },
]

const STEPS = [
  {
    icon: Send,
    title: 'Submit',
    body: 'Sales reps log daily activity from the field. No spreadsheets, no WhatsApp screenshots.',
  },
  {
    icon: CheckCircle2,
    title: 'Approve',
    body: 'Managers review submissions against targets and approve or flag exceptions in one screen.',
  },
  {
    icon: BarChart3,
    title: 'Decide',
    body: 'AI surfaces dormant clients, payment risk, and demand shifts before they cost you revenue.',
  },
]

const TESTIMONIALS = [
  {
    quote:
      'We went from finding out about a quiet client at month-end to getting flagged the week it happened.',
    role: 'Operations manager, distribution company in Lahore',
  },
  {
    quote: 'Our reps stopped sending photos of notebooks. Reports come in clean, every single day.',
    role: 'Sales director, FMCG distributor in Karachi',
  },
]

const FAQS = [
  {
    question: 'How much does Prima cost?',
    answer:
      'Plans start at PKR 2,500/month for up to 5 users, plus a one-time PKR 20,000 setup fee. See the full pricing page for Pro, Business, and Enterprise tiers.',
  },
  {
    question: 'Is there a free trial?',
    answer:
      'Yes. Every plan starts with a 14-day free trial and no credit card is required to begin.',
  },
  {
    question: 'Which AI providers does Prima support?',
    answer:
      'Prima is model-agnostic and works with Claude, OpenAI, Gemini, or a self-hosted Ollama model, configured per organization.',
  },
  {
    question: 'How is our data kept secure?',
    answer:
      'Every tenant is isolated at the database query level, sensitive fields like bank details are encrypted at rest, and all API routes are rate-limited.',
  },
  {
    question: 'We currently track everything in Excel. How hard is migration?',
    answer:
      'Clients, distributors, and products can be bulk-imported from a spreadsheet on day one. Our team helps with the first import during onboarding.',
  },
  {
    question: 'What support do we get?',
    answer:
      'All plans include email support. Business and Enterprise plans include priority support with faster response times.',
  },
]

export default function LandingPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />

      <main id="main-content">
        {/* Hero: asymmetric split */}
        <section className="overflow-hidden pt-16 pb-20 sm:pt-20 sm:pb-28">
          <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:px-8">
            <div>
              <h1 className="text-foreground text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
                From raw data to <span className="text-accent">refined decisions.</span>
              </h1>
              <p className="text-muted-foreground mt-6 max-w-lg text-lg leading-relaxed">
                Replace scattered DSR sheets and WhatsApp updates with one real-time view of sales,
                inventory, and risk.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button
                  size="lg"
                  className="bg-accent text-accent-foreground hover:bg-accent/90"
                  asChild
                >
                  <Link href="/contact?intent=trial">
                    Start free trial
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <Link href="/pricing">See pricing</Link>
                </Button>
              </div>
            </div>

            <Reveal className="flex justify-center lg:justify-end">
              <HeroPreview />
            </Reveal>
          </div>
        </section>

        {/* Problem statement: asymmetric split, image right */}
        <section className="border-border/60 border-t py-20 sm:py-28">
          <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:px-8">
            <Reveal>
              <h2 className="text-foreground text-3xl font-bold tracking-tight sm:text-4xl">
                Distribution runs on guesswork until something breaks.
              </h2>
              <p className="text-muted-foreground mt-5 max-w-xl text-base leading-relaxed">
                Sales reps text updates into group chats. Managers reconcile spreadsheets at
                month-end. By the time a client goes quiet or stock runs low, the revenue is already
                gone. Prima gives every role in your business a live, accurate picture instead of a
                monthly postmortem.
              </p>
            </Reveal>
            <Reveal delay={120} className="order-first lg:order-last">
              <div className="border-border/60 relative aspect-[4/3] overflow-hidden rounded-md border">
                <Image
                  src="https://picsum.photos/seed/prima-distribution-ops/1200/900"
                  alt="Distribution warehouse operations"
                  fill
                  className="object-cover"
                  sizes="(min-width: 1024px) 50vw, 100vw"
                />
              </div>
            </Reveal>
          </div>
        </section>

        {/* Feature bento grid */}
        <section className="border-border/60 border-t py-20 sm:py-28">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <Reveal>
              <h2 className="text-foreground max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">
                Everything your team already needs, in one place.
              </h2>
            </Reveal>

            <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
              {FEATURES.map((feature, i) => {
                const Icon = feature.icon
                return (
                  <Reveal
                    key={feature.title}
                    delay={i * 60}
                    className={feature.large ? 'md:col-span-2' : ''}
                  >
                    <div className="border-border bg-card flex h-full flex-col rounded-md border p-6">
                      <div className="flex items-center justify-between">
                        <span className="bg-accent/15 text-accent flex h-10 w-10 items-center justify-center rounded-md">
                          <Icon className="h-5 w-5" />
                        </span>
                        {feature.stat && (
                          <span className="text-foreground font-mono text-2xl font-bold">
                            {feature.stat}
                          </span>
                        )}
                      </div>
                      <h3 className="text-foreground mt-4 text-base font-semibold">
                        {feature.title}
                      </h3>
                      {feature.body && (
                        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                          {feature.body}
                        </p>
                      )}
                      {feature.checklist && (
                        <ul className="mt-3 space-y-2">
                          {feature.checklist.map((item) => (
                            <li key={item} className="flex items-start gap-2 text-sm">
                              <Check className="text-accent mt-0.5 h-4 w-4 shrink-0" />
                              <span className="text-muted-foreground">{item}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                      {feature.preview === 'ai' && (
                        <div className="mt-5 hidden sm:block">
                          <AiChatPreview />
                        </div>
                      )}
                    </div>
                  </Reveal>
                )
              })}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="border-border/60 border-t py-20 sm:py-28">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <Reveal>
              <h2 className="text-foreground max-w-xl text-3xl font-bold tracking-tight sm:text-4xl">
                Three steps from field report to business decision.
              </h2>
            </Reveal>

            <div className="mt-12 grid grid-cols-1 gap-10 sm:grid-cols-3">
              {STEPS.map((step, i) => {
                const Icon = step.icon
                return (
                  <Reveal key={step.title} delay={i * 100}>
                    <span className="bg-primary text-primary-foreground flex h-11 w-11 items-center justify-center rounded-md">
                      <Icon className="h-5 w-5" />
                    </span>
                    <h3 className="text-foreground mt-5 text-lg font-semibold">{step.title}</h3>
                    <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                      {step.body}
                    </p>
                  </Reveal>
                )
              })}
            </div>
          </div>
        </section>

        {/* Pricing teaser */}
        <section className="border-border/60 border-t py-20 sm:py-28">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <Reveal className="text-center">
              <h2 className="text-foreground text-3xl font-bold tracking-tight sm:text-4xl">
                Simple, transparent pricing.
              </h2>
              <p className="text-muted-foreground mx-auto mt-4 max-w-md text-base">
                No hidden fees. Cancel anytime.
              </p>
            </Reveal>
            <div className="mt-12">
              <PricingTable teaser />
            </div>
            <p className="text-muted-foreground mt-8 text-center text-sm">
              Need more than 50 users or custom AI allocation?{' '}
              <Link href="/pricing" className="text-accent font-medium hover:underline">
                See Enterprise pricing
              </Link>
            </p>
          </div>
        </section>

        {/* Testimonials */}
        <section className="border-border/60 border-t py-20 sm:py-28">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <Reveal>
              <h2 className="text-foreground text-3xl font-bold tracking-tight sm:text-4xl">
                What early teams are telling us.
              </h2>
            </Reveal>
            <div className="mt-12 grid grid-cols-1 gap-10 sm:grid-cols-2">
              {TESTIMONIALS.map((t, i) => (
                <Reveal key={t.role} delay={i * 100}>
                  <p className="text-foreground text-lg leading-relaxed">&ldquo;{t.quote}&rdquo;</p>
                  <p className="text-muted-foreground mt-4 text-sm">{t.role}</p>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="border-border/60 border-t py-20 sm:py-28">
          <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
            <Reveal>
              <h2 className="text-foreground text-3xl font-bold tracking-tight sm:text-4xl">
                Frequently asked questions.
              </h2>
            </Reveal>
            <div className="mt-10">
              <FaqAccordion items={FAQS} />
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="border-border/60 bg-primary dark:bg-secondary border-t py-20 sm:py-28">
          <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
            <h2 className="text-primary-foreground dark:text-secondary-foreground text-3xl font-bold tracking-tight sm:text-4xl">
              See your business clearly, starting today.
            </h2>
            <p className="text-primary-foreground/70 dark:text-secondary-foreground/70 mx-auto mt-4 max-w-md text-base">
              14-day free trial. No credit card required.
            </p>
            <Button
              size="lg"
              className="bg-accent text-accent-foreground hover:bg-accent/90 mt-8"
              asChild
            >
              <Link href="/contact?intent=trial">
                Start free trial
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}
