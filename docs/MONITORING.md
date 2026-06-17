# Monitoring & Alerting

## Errors — Sentry

Configured via `sentry.client.config.ts` / `sentry.server.config.ts`, gated
on `NEXT_PUBLIC_SENTRY_DSN` being set (no-op otherwise, including in tests
and local dev without a DSN).

- `withTenantApi` (`src/lib/api-helpers.ts`) captures every unexpected API
  error tagged with `organizationId`/`organizationSlug` and the acting
  `user.id` — filter by tenant in Sentry's issue list instead of grepping logs.
- `global-error.tsx` captures root-layout crashes (these run outside the
  normal provider tree, so they can't use tenant context).

## Product analytics — PostHog

`src/components/analytics/posthog-provider.tsx`, mounted in the root layout.
No-op until `NEXT_PUBLIC_POSTHOG_KEY` is set — safe to leave unset in any
environment that doesn't need analytics (CI, local dev). Captures pageviews
manually (App Router client navigations don't fire PostHog's own listener);
add `posthog.capture('event_name', {...})` calls at specific feature
interactions as the product team identifies what to track.

## Uptime — UptimeRobot / BetterStack

Not wired in code (external service, no API integration needed for a basic
ping monitor). Setup once in production:

1. Create a monitor against `https://<your-domain>/` (the public landing
   page — fast, no auth, no DB query, so a failure there means the whole
   edge/CDN path is down) on a 1–5 min interval.
2. Add a second monitor against an authenticated health-check route if one
   is added later (e.g. `/api/health` hitting the DB) to catch
   "app is up but DB is down" separately from "app is fully down."
3. Point alerts at the same on-call channel as `ONCALL_ALERT_EMAIL` /
   `ONCALL_WHATSAPP_TO` below, so there's one place the on-call person checks.

## Database query performance

Neon and Supabase both expose `pg_stat_statements` for slow-query analysis
(Neon: dashboard → Monitoring → Query insights; Supabase: dashboard →
Database → Query Performance). No app-level instrumentation needed — check
this monthly, or whenever a dashboard endpoint feels slow, against the
indexes declared in `prisma/schema.prisma` (Phase 4 + Phase 7 added
composite indexes specifically for the dashboard aggregation queries — see
`src/app/api/v1/dashboards/*`).

## BullMQ queue depth (Phase 7)

`src/lib/workers/queue-monitor.ts` polls every queue's job counts every 15
minutes (`registerQueueMonitor()`, started in `src/lib/workers/index.ts`
alongside the other workers — runs in the same long-lived worker process,
not in a Next.js serverless route) and fires an on-call alert when:

- **waiting > 500** — a queue is backing up faster than its worker can drain
  it (warning)
- **failed > 10** — jobs are erroring repeatedly, not just queueing
  (critical)

Thresholds are constants at the top of `queue-monitor.ts` — tune them once
real traffic volume is known; 500/10 are conservative starting points for a
pre-launch app.

## On-call alert routing

`src/lib/alerts.ts` → `sendOnCallAlert(subject, body, severity)`:

- **Email** (always, if `ONCALL_ALERT_EMAIL` is set) — routes through the
  same `sendEmail()` wrapper as customer email, so it respects the bounce
  suppression list too (see `docs/EMAIL_DELIVERABILITY.md`).
- **WhatsApp via Twilio** (optional, best-effort) — needs all four of
  `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM`,
  `ONCALL_WHATSAPP_TO` set; silently skipped otherwise (no error, no crash —
  email-only alerting is a fully supported configuration). Twilio's
  WhatsApp Business API requires the `TWILIO_WHATSAPP_FROM` number to be a
  Twilio WhatsApp sender already approved/sandboxed in the Twilio console;
  see Twilio's WhatsApp onboarding docs before setting this in production.

Currently called from `queue-monitor.ts` only. Wire it into other
operational failure paths as they're identified post-launch (e.g. a payment
provider being unreachable, a worker crash-looping).
