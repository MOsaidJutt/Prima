# Deployment

Prima deploys as a Next.js app (web + API routes) plus a set of scheduled
jobs. The jobs run either inside a long-running BullMQ worker process or over
HTTP from an external scheduler — see §2. The HTTP path exists so the whole
product can run on a serverless host with no second service to pay for.

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

## 2. Scheduled jobs

Prima has nine scheduled jobs. Their logic lives in `src/lib/jobs/`, which
imports no BullMQ or Redis code, so the same functions run two ways. Pick
**one** — running both would double up work (jobs are written to tolerate it,
but there is no reason to pay twice).

| Job                      | Schedule (UTC) | What it does                                   |
| ------------------------ | -------------- | ---------------------------------------------- |
| `performance-snapshot`   | `30 0 * * *`   | Build yesterday's per-rep snapshots            |
| `invoice-overdue`        | `0 1 * * *`    | Mark issued invoices overdue past due date     |
| `matview-refresh`        | `0 2 * * *`    | Refresh dashboard materialized views           |
| `inventory-prediction`   | `0 3 * * *`    | Regenerate demand forecasts                    |
| `dormant-client`         | `0 4 * * *`    | Flag high-value clients who stopped ordering   |
| `payment-reminder`       | `0 7 * * *`    | Client reminders at −3/0/+7/+14/+30 days       |
| `subscription-lifecycle` | `0 6 * * *`    | Renewals, trial reminders, past-due escalation |
| `anomaly-detection`      | `0 */6 * * *`  | Revenue drops, skipped DSRs, order spikes      |
| `platform-invoicing`     | `0 5 1 * *`    | Monthly platform invoices                      |

The schedules above are defined once in `src/lib/jobs/index.ts` and used by
both paths, so they cannot drift.

### Option A — HTTP cron (no persistent process)

Best when the app is on a serverless host. Each job is exposed at
`GET /api/cron/<job>`, authenticated with a shared secret.

1. Set `CRON_SECRET` in the app's environment (`openssl rand -hex 32`).
   The endpoint returns 503 and runs nothing if it is unset.
2. Point any scheduler at `https://your-domain/api/cron/<job>` on the
   schedule above, sending the secret as either header:
   - `Authorization: Bearer <CRON_SECRET>` (what Vercel Cron sends), or
   - `x-cron-secret: <CRON_SECRET>`
3. [cron-job.org](https://cron-job.org) covers all nine on its free tier.
   Vercel's own cron works too, but the Hobby plan allows only two jobs at
   daily-or-slower frequency, which cannot express `anomaly-detection`.

**Limit to watch:** serverless functions are capped at 60s on Vercel. With few
tenants the jobs finish well inside that, but `inventory-prediction` grows with
org and product count because it makes an LLM call per product. If that job
starts timing out, move to Option B — it is a hosting change, not a code change.

### Option B — persistent worker process

`src/lib/workers/index.ts` is the entry point for every BullMQ worker plus the
queue-depth monitor. Queue-depth alerting only works on this path, since it
inspects BullMQ state.

1. Deploy it as its own service on Fly.io, Railway, or Render (any platform
   that runs a long-lived Node process).
2. Start command: `npx tsx src/lib/workers/index.ts`
3. Point it at the same `DATABASE_URL` and `REDIS_URL` as the web app, plus
   the email/AI/billing env vars the workers themselves use (`RESEND_API_KEY`,
   `EMAIL_FROM`, `STRIPE_SECRET_KEY`, the AI provider keys, `ONCALL_ALERT_EMAIL`).
4. The process registers its own cron schedules on boot (`registerCrons()`)
   and shuts down cleanly on `SIGTERM`, so a standard rolling-restart deploy
   is safe.
5. Leave `CRON_SECRET` unset (or stop calling the endpoints) so jobs do not
   run on both paths.

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
