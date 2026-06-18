# Launch Checklist

Status as of the Phase 7 build. Items marked done were verified in this
codebase; items marked pending require either live infrastructure access
or a one-time manual action this assistant cannot perform from the repo.

## Code quality

- [x] Production build green (`npm run build`)
- [x] Typecheck clean (`npx tsc --noEmit`)
- [x] Lint clean (`npm run lint`)
- [x] Unit/integration test suite passing (`npx vitest run`)
- [ ] E2E tests passing in CI (`npm run test:e2e`) — Playwright suite exists
      under `tests/e2e/`; run it against a real CI environment with a real
      database before launch, since several specs need DB state.

## Security

- [x] `npm audit` clean of high/critical findings
- [x] Tenant isolation covered by automated tests (`src/test/security.test.ts`,
      `src/test/tenant-context.test.ts`)
- [x] PII (NTN/STRN, bank account, IBAN) encrypted at rest
- [x] Rate limiting on auth, password reset, and contact form endpoints
- [x] Security headers + CSP configured (`next.config.ts`)
- [ ] Third-party penetration test — recommended before accepting real
      customer financial data at scale, not performed as part of this build.

## Performance

- [x] Database indexes added for dashboard aggregation queries
- [x] Redis caching on dashboard/aggregation endpoints
- [x] `next/image` used for org-uploaded images
- [ ] Lighthouse audit run against the deployed production URL (run once
      DNS/hosting is live; cannot be measured against localhost meaningfully)

## Monitoring

- [x] Sentry wired with tenant-context tagging
- [x] PostHog wired (pageviews)
- [x] BullMQ queue-depth alerting
- [x] On-call alert routing (email, optional WhatsApp via Twilio)
- [ ] Uptime monitor (UptimeRobot/BetterStack) configured against the live
      domain — see `docs/MONITORING.md`
- [ ] `pg_stat_statements` reviewed once real traffic exists

## Backups

- [ ] Neon PITR retention window confirmed against your plan
- [ ] Restore drill performed at least once (see `docs/BACKUP_AND_DR.md`)
- [ ] R2 bucket versioning enabled

## Documentation

- [x] README covers architecture, local dev, and env vars
- [x] CONTRIBUTING.md
- [x] SECURITY.md
- [x] `/docs` route live with getting-started, feature guides, API
      reference, and FAQ

## Marketing site

- [x] Landing page, pricing, about, contact, privacy, terms live
- [x] Sitemap and robots.txt
- [ ] Real product screenshots/photography (current build uses real
      component previews and one placeholder photo)

## Go-live

- [ ] Stripe account moved from test mode to live mode, webhook endpoint
      updated to the production URL
- [ ] Resend sending domain verified (SPF/DKIM/DMARC) — see
      `docs/EMAIL_DELIVERABILITY.md`
- [ ] Custom domain + SSL attached in Vercel
- [ ] Demo organization (`scripts` / `prisma/seed.ts`) working end to end
      against production-shaped data, separate from real customer orgs
- [ ] Super Admin account created and credentials stored securely
- [ ] `phase7_email_suppression` migration applied (pending Neon
      connectivity as of this build — see git log for context)
