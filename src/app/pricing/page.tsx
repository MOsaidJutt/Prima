import type { Metadata } from 'next'
import { Check, Minus } from 'lucide-react'
import { SiteHeader } from '@/components/marketing/site-header'
import { SiteFooter } from '@/components/marketing/site-footer'
import { PricingTable } from '@/components/marketing/pricing-table'
import { FaqAccordion } from '@/components/marketing/faq-accordion'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export const metadata: Metadata = {
  title: 'Pricing',
  description:
    'Prima pricing: Starter, Pro, Business, and Enterprise plans for distribution businesses. 14-day free trial, no credit card required.',
}

const COMPARISON_ROWS: { label: string; values: [string, string, string, string] }[] = [
  { label: 'Users included', values: ['5', '15', '50', 'Unlimited'] },
  { label: 'AI tokens / month', values: ['None', '200,000', '1,000,000', 'Custom'] },
  { label: 'Invoice templates', values: ['1', '3', 'Unlimited', 'Unlimited'] },
  { label: 'Per-user AI quotas', values: ['no', 'no', 'yes', 'yes'] },
  { label: 'Custom domain', values: ['no', 'no', 'yes', 'yes'] },
  { label: 'Priority support', values: ['no', 'no', 'yes', 'yes'] },
  { label: 'Uptime SLA', values: ['no', 'no', 'no', '99.9%'] },
]

const BILLING_FAQS = [
  {
    question: 'Why is there a setup fee?',
    answer:
      'The PKR 20,000 one-time setup fee covers onboarding: importing your existing clients and distributors, configuring dashboards, and training your team. It is waived entirely if you choose annual billing.',
  },
  {
    question: 'What happens when we hit our monthly AI token limit?',
    answer:
      'You can configure an auto-top-up threshold (for example, at 90% usage) so a token pack is purchased automatically and your AI features never interrupt. Without auto-top-up, AI features pause until the next billing cycle or a manual top-up.',
  },
  {
    question: 'Can we change plans later?',
    answer:
      'Yes. Upgrades take effect immediately with a prorated charge. Downgrades take effect at the start of your next billing cycle.',
  },
  {
    question: 'Can we cancel anytime?',
    answer:
      'Yes, with no long-term contract. If you cancel mid-cycle, you keep access until the end of the period you already paid for.',
  },
]

function valueCell(value: string) {
  if (value === 'yes') return <Check className="text-accent mx-auto h-4 w-4" />
  if (value === 'no') return <Minus className="text-muted-foreground mx-auto h-4 w-4" />
  return <span className="font-mono text-sm">{value}</span>
}

export default function PricingPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />

      <main id="main-content" className="py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
          <h1 className="text-foreground text-4xl font-bold tracking-tight sm:text-5xl">
            Plans that scale with your business.
          </h1>
          <p className="text-muted-foreground mx-auto mt-5 max-w-xl text-lg leading-relaxed">
            14-day free trial on every plan. No credit card required to start.
          </p>
        </div>

        <div className="mx-auto mt-14 max-w-7xl px-4 sm:px-6 lg:px-8">
          <PricingTable />
        </div>

        <div className="mx-auto mt-24 max-w-5xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-foreground text-center text-2xl font-bold tracking-tight sm:text-3xl">
            Compare plans in detail.
          </h2>
          <div className="border-border mt-10 overflow-hidden rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-foreground">Feature</TableHead>
                  <TableHead className="text-foreground text-center">Starter</TableHead>
                  <TableHead className="text-foreground text-center">Pro</TableHead>
                  <TableHead className="text-foreground text-center">Business</TableHead>
                  <TableHead className="text-foreground text-center">Enterprise</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {COMPARISON_ROWS.map((row) => (
                  <TableRow key={row.label}>
                    <TableCell className="text-foreground font-medium">{row.label}</TableCell>
                    {row.values.map((value, i) => (
                      <TableCell key={i} className="text-center">
                        {valueCell(value)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        <div className="mx-auto mt-24 max-w-3xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-foreground text-center text-2xl font-bold tracking-tight sm:text-3xl">
            Billing questions.
          </h2>
          <div className="mt-10">
            <FaqAccordion items={BILLING_FAQS} />
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}
