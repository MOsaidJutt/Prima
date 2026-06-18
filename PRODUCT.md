# Product

## Register

product

## Users

Operations managers, sales directors, and business owners at distribution
companies in Pakistan, plus the sales reps and finance staff they manage.
Their job: replace WhatsApp-group sales updates and end-of-month Excel
reconciliation with a live, accurate picture of sales, inventory, and
payment risk. Primary workflow per screen: a rep submitting a daily sales
report, a manager approving/flagging it, or an owner reading a
role-specific dashboard to decide what needs attention today.

A secondary surface (brand register) is the public marketing site
(`/`, `/pricing`, `/about`, `/contact`, `/docs`, `/privacy`, `/terms`),
aimed at the same operations managers and business owners before they
become tenants.

## Product Purpose

Prima is a multi-tenant daily sales reporting (DSR) and AI insights
platform for distribution businesses. It exists because distribution
companies currently run on scattered spreadsheets and chat messages with
no real-time visibility into what reps are selling, which clients are
going quiet, or whether inventory will run out before it's too late.
Success looks like: a manager catching a dormant client or a stock-out
before it costs revenue, instead of finding out at month-end.

## Brand Personality

Sharp, trustworthy, B2B. Confident and data-forward, not flashy. The tone
should read like a serious operations tool a business owner can trust with
financial data, not a consumer app chasing engagement. Copy is direct and
concrete (what the product actually does), never aspirational filler.

## Anti-references

Generic AI-slop SaaS: purple/blue gradient glows, glassmorphism panels,
centered-hero-over-dark-mesh, three identical feature cards, decorative
eyebrows on every section. Also avoid looking like a consumer
productivity app (playful illustrations, rounded mascot-y UI); Prima
handles real financial and operational data and should look like it.

## Design Principles

1. **One product, two surfaces.** The marketing site and the authenticated
   app share the same design tokens (navy/blue B2B palette, Plus Jakarta
   Sans, shadcn/ui, 6px radius) so a prospect's first impression matches
   the product they're about to use.
2. **Show the real thing, not a mockup.** Product previews on the
   marketing site are built from the actual component library (real
   Card/Badge primitives), not div-based fake screenshots.
3. **Density serves the task.** Dashboards and data tables can be dense
   when the user is scanning for an exception; marketing pages stay
   airy because they're selling, not reporting.
4. **Trust over delight.** Every design decision is weighed against "would
   this make an operations manager trust this with their financial data,"
   not "is this fun."
5. **Real numbers, not fabricated precision.** Pricing, plan limits, and
   any other figure shown to users must trace back to actual seeded data
   or real product behavior, never an invented-sounding stat.

## Accessibility & Inclusion

WCAG 2.1 AA target across the app: keyboard navigation, labeled form
fields, 4.5:1 text contrast, visible focus indicators, skip-to-content
link, aria-labels on icon-only buttons. Already implemented in Phase 7
of this build; new surfaces should hold the same bar.
