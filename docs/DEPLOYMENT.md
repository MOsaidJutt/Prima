# Deployment

Prima has two deployable pieces: the Next.js app (web + API routes) and a
long-running worker process (BullMQ). They deploy separately because
serverless platforms cannot host the persistent worker.

## 1. Next.js app on Vercel

1. Import the repository into a new Vercel project.
2. Framework preset: Next.js (auto-detected). Build command and output are
   the defaults (`next build`).
3. Set every environment variable from `.env.example` in Vercel's project
   settings (Production, and again for Preview if you want preview
   deployments to work against a separate database). At minimum:
   - `DATABASE_URL`, `REDIS_URL` (or `UPSTASH_REDIS_REST_URL`/`_TOKEN`),
     `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `ENCRYPTION_MASTER_KEY`,
     `PII_ENCRYPTION_KEY`
   - `RESEND_API_KEY`, `EMAIL_FROM`, `RESEND_WEBHOOK_SECRET`, `SALES_EMAIL`
   - `CLOUDFLARE_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`,
     `R2_BUCKET_NAME`, `R2_PUBLIC_URL`
   - `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
     `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
   - `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_AUTH_TOKEN`, `NEXT_PUBLIC_POSTHOG_KEY`
   - `ONCALL_ALERT_EMAIL` and, optionally, the four `TWILIO_*` vars
   - `NEXT_PUBLIC_APP_URL` set to your real production domain (used for
     `sitemap.xml`, `robots.txt`, and email links)
4. Run database migrations against production **before** the first deploy
   that depends on new schema: `npx prisma migrate deploy` (from CI, or
   locally with the production `DATABASE_URL`).
5. Add your custom domain in Vercel's domain settings. Vercel provisions
   and renews the SSL certificate automatically; no manual cert management
   is needed.

## 2. Worker process

`src/lib/workers/index.ts` is the entry point for every BullMQ worker
(invoice overdue, payment reminders, performance snapshots, inventory
prediction, dormant-client detection, anomaly detection, platform
invoicing, subscription lifecycle, matview refresh) plus the Phase 7
queue-depth monitor. It needs a persistent Node.js process, not a
serverless function.

1. Deploy it as its own service on Fly.io, Railway, or Render (any platform
   that runs a long-lived Node process).
2. Start command: `npx tsx src/lib/workers/index.ts`
3. Point it at the same `DATABASE_URL` and `REDIS_URL` as the web app, plus
   the email/AI/billing env vars the workers themselves use (`RESEND_API_KEY`,
   `EMAIL_FROM`, `STRIPE_SECRET_KEY`, the AI provider keys, `ONCALL_ALERT_EMAIL`).
4. The process registers its own cron schedules on boot (`registerCrons()`)
   and shuts down cleanly on `SIGTERM`, so a standard rolling-restart deploy
   is safe.

## 3. Staging environment

Create a second Vercel project (or a separate environment within the same
project) pointed at a separate Neon database branch and a separate Upstash
Redis database. Neon's branching feature is a cheap way to get a staging
database that mirrors production schema without duplicating data. Run a
second worker process instance against the same staging `DATABASE_URL`/
`REDIS_URL` if you need background jobs to run in staging too.

## 4. Production infrastructure tiers

| Service        | Local dev                                         | Production                                                  |
| -------------- | ------------------------------------------------- | ----------------------------------------------------------- |
| Postgres       | local Docker container                            | Neon (serverless Postgres, autoscaling, branching)          |
| Redis          | local Docker container                            | Upstash (serverless Redis, REST API for edge compatibility) |
| File storage   | not required                                      | Cloudflare R2                                               |
| Email          | not required (logs only without `RESEND_API_KEY`) | Resend                                                      |
| Payments       | Stripe test mode                                  | Stripe live mode                                            |
| Error tracking | optional                                          | Sentry                                                      |
| Analytics      | optional                                          | PostHog                                                     |

## 5. Post-deploy checklist

See `docs/LAUNCH_CHECKLIST.md` for the full pre-launch checklist. At minimum
after every deploy: confirm `npx prisma migrate deploy` ran cleanly, hit
`/` and one authenticated route to confirm the app boots, and check Sentry
for new errors in the first 15 minutes.
