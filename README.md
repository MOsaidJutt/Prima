# Prima

Multi-tenant daily sales reporting (DSR) and AI insights platform for
distribution businesses. Sales reps submit daily reports, managers approve
them, and 11 role-specific dashboards plus an AI assistant turn that data
into decisions, on top of invoicing, inventory, and platform billing.

Public site, pricing, and docs: see `/`, `/pricing`, and `/docs` once the
app is running.

## Tech stack

- **Framework**: Next.js 16 (App Router), React 19, TypeScript (strict)
- **Database**: PostgreSQL via Prisma 6 (Neon in production)
- **Cache / queues**: Redis via `ioredis` + BullMQ for background jobs,
  Upstash Redis (REST) for rate limiting
- **Auth**: session-based, custom implementation on top of `better-auth`
  primitives (`src/lib/auth/`)
- **Styling**: Tailwind CSS v4 + shadcn/ui, with `next-themes` for light/dark
- **Email**: Resend + React Email templates, bounce/complaint suppression
- **Payments**: Stripe (tenant subscriptions, top-ups, platform invoicing)
- **File storage**: Cloudflare R2
- **AI**: Vercel AI SDK, provider-agnostic (Anthropic Claude, OpenAI,
  Google Gemini, or a self-hosted Ollama endpoint, configured per tenant)
- **i18n**: `next-intl`, English shipped, structure ready for Urdu (RTL)
- **Monitoring**: Sentry (errors), PostHog (product analytics)
- **Testing**: Vitest (unit/integration), Playwright (E2E)

## Architecture highlights

- **Multi-tenancy**: every tenant-scoped API route runs through
  `withTenantApi` (`src/lib/api-helpers.ts`), which resolves the session,
  injects `organizationId` into every query, and reports errors to Sentry
  tagged with tenant context. Tenant isolation is covered by automated
  tests (`src/test/tenant-context.test.ts`, `src/test/security.test.ts`).
- **Route groups**: `src/app/(tenant)/*` is the tenant-facing app (admin,
  manager, dashboard, onboarding); `src/app/(super-admin)/*` is the
  platform operator console (organizations, billing, revenue). Public
  marketing pages (`/`, `/pricing`, `/about`, `/contact`, `/docs`,
  `/privacy`, `/terms`) live outside both groups and are statically
  prerendered.
- **PII encryption**: financial identifiers (NTN/STRN, bank account
  numbers, IBANs) are encrypted with AES-256-GCM transparently through a
  Prisma Client Extension (`src/lib/prisma.ts`, `src/lib/crypto.ts`) so
  application code reads and writes plaintext while the database only
  ever stores ciphertext.
- **Background jobs**: BullMQ workers (`src/lib/workers/`) run as a
  separate long-lived process from the Next.js app, handling invoice
  overdue marking, payment reminders, performance snapshots, inventory
  demand prediction, dormant-client detection, anomaly detection, platform
  invoicing, subscription lifecycle, materialized view refresh, and
  (Phase 7) queue-depth monitoring with on-call alerting.
- **Dashboards**: 11 role-specific dashboards with drag-and-drop widget
  customization, backed by materialized views and Redis caching for
  aggregation-heavy queries.

## Local development

```bash
npm install
cp .env.example .env
```

Fill in at least `DATABASE_URL` and `REDIS_URL` in `.env` (a local Postgres
and Redis via Docker work fine; production uses Neon and Upstash). See
`.env.example` for every variable, with inline comments on which are
required versus optional in development.

```bash
npx prisma migrate dev   # apply migrations
npx tsx prisma/seed.ts   # seed billing plans, a demo org, and a super admin
npm run dev              # http://localhost:3000
```

To run background jobs locally (overdue invoices, AI predictions, the
Phase 7 queue monitor, etc.):

```bash
npx tsx src/lib/workers/index.ts
```

### Useful scripts

| Command                                   | What it does                                                                 |
| ----------------------------------------- | ---------------------------------------------------------------------------- |
| `npm run dev`                             | Start the Next.js dev server                                                 |
| `npm run build` / `npm run start`         | Production build / serve                                                     |
| `npm run typecheck`                       | `tsc --noEmit`                                                               |
| `npm run lint` / `lint:fix`               | ESLint                                                                       |
| `npm run format`                          | Prettier                                                                     |
| `npx vitest run`                          | Unit/integration tests                                                       |
| `npm run test:e2e`                        | Playwright E2E (`tests/e2e/`)                                                |
| `npx prisma studio`                       | Browse the database                                                          |
| `npx tsx scripts/encrypt-pii-backfill.ts` | One-time backfill after setting `PII_ENCRYPTION_KEY` on an existing database |

## Documentation

- [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) — Vercel + worker process + staging setup
- [`docs/BACKUP_AND_DR.md`](docs/BACKUP_AND_DR.md) — backup retention and restore drills
- [`docs/MONITORING.md`](docs/MONITORING.md) — Sentry, PostHog, uptime, queue-depth alerting
- [`docs/EMAIL_DELIVERABILITY.md`](docs/EMAIL_DELIVERABILITY.md) — SPF/DKIM/DMARC, bounce handling
- [`docs/LAUNCH_CHECKLIST.md`](docs/LAUNCH_CHECKLIST.md) — pre-launch checklist
- [`CONTRIBUTING.md`](CONTRIBUTING.md) — local setup, conventions, PR checks
- [`SECURITY.md`](SECURITY.md) — vulnerability disclosure, what's already hardened
- In-app `/docs` route — end-user getting-started guide, feature guides, API reference, FAQ

## Deployment

See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md). Short version: the Next.js
app deploys to Vercel; the BullMQ worker process deploys separately to any
platform that runs a persistent Node process (Fly.io, Railway, Render).
