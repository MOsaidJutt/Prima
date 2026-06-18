'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { PRICING_PLANS } from './pricing-data'

function formatPkr(amount: number) {
  return new Intl.NumberFormat('en-PK', { maximumFractionDigits: 0 }).format(amount)
}

export function PricingTable({ teaser = false }: { teaser?: boolean }) {
  const [annual, setAnnual] = useState(false)
  const plans = teaser ? PRICING_PLANS.slice(0, 3) : PRICING_PLANS

  return (
    <div>
      <div className="mb-12 flex items-center justify-center gap-3">
        <span
          className={cn(
            'text-sm font-medium',
            !annual ? 'text-foreground' : 'text-muted-foreground'
          )}
        >
          Monthly
        </span>
        <Switch checked={annual} onCheckedChange={setAnnual} aria-label="Toggle annual billing" />
        <span
          className={cn(
            'text-sm font-medium',
            annual ? 'text-foreground' : 'text-muted-foreground'
          )}
        >
          Annual
        </span>
        <span className="bg-success/15 text-success rounded-full px-2.5 py-1 text-xs font-semibold">
          Save 17%
        </span>
      </div>

      <div
        className={cn(
          'mx-auto grid grid-cols-1 gap-6 md:grid-cols-2',
          teaser ? 'lg:grid-cols-3' : 'lg:grid-cols-4'
        )}
      >
        {plans.map((plan) => {
          const isCustom = plan.monthlyPrice === null
          const price = annual ? plan.annualPrice : plan.monthlyPrice
          return (
            <div
              key={plan.tier}
              className={cn(
                'relative flex flex-col rounded-md border p-6',
                plan.popular ? 'border-accent bg-card shadow-lg' : 'border-border bg-card'
              )}
            >
              {plan.popular && (
                <span className="bg-accent text-accent-foreground absolute -top-3 left-6 rounded-full px-3 py-1 text-xs font-semibold">
                  Most popular
                </span>
              )}
              <h3 className="text-foreground text-lg font-semibold">{plan.name}</h3>
              <p className="text-muted-foreground mt-1 text-sm">{plan.description}</p>

              <div className="mt-6">
                {isCustom ? (
                  <span className="text-foreground text-3xl font-bold tracking-tight">Custom</span>
                ) : (
                  <div className="flex items-baseline gap-1">
                    <span className="text-foreground font-mono text-3xl font-bold tracking-tight">
                      PKR {formatPkr(price as number)}
                    </span>
                    <span className="text-muted-foreground text-sm">/{annual ? 'yr' : 'mo'}</span>
                  </div>
                )}
                <p className="text-muted-foreground mt-2 text-xs">
                  {isCustom
                    ? 'Talk to us for a tailored quote'
                    : `+ PKR ${formatPkr(plan.setupFee as number)} setup fee`}
                </p>
              </div>

              <ul className="mt-6 flex-1 space-y-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm">
                    <Check className="text-accent mt-0.5 h-4 w-4 shrink-0" />
                    <span className="text-foreground">{feature}</span>
                  </li>
                ))}
              </ul>

              <Button
                className={cn(
                  'mt-8 w-full',
                  plan.popular && 'bg-accent text-accent-foreground hover:bg-accent/90'
                )}
                variant={plan.popular ? 'default' : 'outline'}
                asChild
              >
                <Link href={isCustom ? '/contact' : '/contact?intent=trial'}>
                  {isCustom ? 'Talk to sales' : 'Start free trial'}
                </Link>
              </Button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
