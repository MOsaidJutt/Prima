import type { Metadata } from 'next'
import { Target, Users2, Sparkles } from 'lucide-react'
import { SiteHeader } from '@/components/marketing/site-header'
import { SiteFooter } from '@/components/marketing/site-footer'

export const metadata: Metadata = {
  title: 'About',
  description: 'Why we built Prima for distribution businesses in Pakistan.',
}

const VALUES = [
  {
    icon: Target,
    title: 'Built from the field, not a boardroom',
    body: 'Every feature in Prima maps to a real workflow we watched break down on a spreadsheet or in a WhatsApp group.',
  },
  {
    icon: Users2,
    title: 'Every role gets a view that fits them',
    body: 'A sales rep, a finance manager, and a business owner need different information. Prima gives each of them their own dashboard, not one dashboard for everyone.',
  },
  {
    icon: Sparkles,
    title: 'AI that watches, not AI for its own sake',
    body: 'We only ship an AI feature when it catches something a person would otherwise miss: a quiet client, a stock-out, a payment risk.',
  },
]

export default function AboutPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />

      <main id="main-content" className="py-16 sm:py-20">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <h1 className="text-foreground text-4xl font-bold tracking-tight sm:text-5xl">
            We build software for the businesses that move goods.
          </h1>
          <p className="text-muted-foreground mt-6 text-lg leading-relaxed">
            Distribution companies in Pakistan run on relationships, routes, and reports, mostly
            kept in spreadsheets and group chats. Prima started as a way to give one distributor a
            real-time view of their sales team. It grew into a full platform: reporting, dashboards,
            invoicing, and AI that watches the business when no one else can.
          </p>
        </div>

        <div className="mx-auto mt-20 max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-10 sm:grid-cols-3">
            {VALUES.map((value) => {
              const Icon = value.icon
              return (
                <div key={value.title}>
                  <span className="bg-accent/15 text-accent flex h-10 w-10 items-center justify-center rounded-md">
                    <Icon className="h-5 w-5" />
                  </span>
                  <h2 className="text-foreground mt-5 text-base font-semibold">{value.title}</h2>
                  <p className="text-muted-foreground mt-2 text-sm leading-relaxed">{value.body}</p>
                </div>
              )
            })}
          </div>
        </div>

        <div className="mx-auto mt-20 max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="border-border bg-card rounded-md border p-8">
            <h2 className="text-foreground text-xl font-semibold">Where we are today</h2>
            <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
              Prima is in active use with early distribution partners across Pakistan, with the
              platform supporting daily sales reporting, 11 role-specific dashboards, invoicing, and
              an AI assistant grounded in each tenant&apos;s own data. We are onboarding new teams
              directly, so the fastest way in is a conversation with us.
            </p>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}
