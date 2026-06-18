# Security Policy

## Reporting a vulnerability

If you believe you've found a security vulnerability in Prima, please
email **security@prima.app** rather than opening a public GitHub issue.
Include steps to reproduce and the potential impact. We aim to acknowledge
reports within 2 business days.

Please do not test against other tenants' real data, attempt denial of
service, or exfiltrate data beyond what's needed to demonstrate the issue.

## What's already in place

- **Tenant isolation**: every database query in `/api/v1/*` routes is
  scoped to the authenticated user's organization through
  `withTenantApi` (`src/lib/api-helpers.ts`). Cross-tenant access is
  covered by automated tests (`src/test/security.test.ts`,
  `src/test/tenant-context.test.ts`).
- **Encryption at rest**: sensitive financial fields (NTN/STRN, bank
  account numbers, IBANs) are encrypted with AES-256-GCM before being
  written to the database (`src/lib/crypto.ts`, `src/lib/prisma.ts`).
  Tenant-level AI provider API keys are similarly encrypted.
- **Rate limiting**: login, password reset, the public contact form, and
  general API traffic are rate-limited per IP or per user via Upstash
  (`src/lib/rate-limit.ts`). Rate limiting is mandatory (not silently
  disabled) when `NODE_ENV=production`.
- **Security headers**: CSP, HSTS, `X-Frame-Options: SAMEORIGIN`,
  `X-Content-Type-Options: nosniff`, and a restrictive `Permissions-Policy`
  are set on every response (`next.config.ts`).
- **Webhook verification**: Stripe and Resend webhooks are verified with
  the provider's signing secret before being processed
  (`src/app/api/webhooks/*`).
- **Dependency hygiene**: `npm audit` is checked as part of the Phase 7
  hardening pass; high/critical findings are resolved or the dependency is
  replaced (see git history for the `xlsx` -> `exceljs`/`papaparse` and
  Vitest 2 -> 4 migrations).
- **No stack traces in production**: unhandled errors return a generic
  message to the client and are reported to Sentry with tenant context
  server-side (`src/lib/api-helpers.ts`, `src/app/global-error.tsx`).

## Supported versions

Only the latest commit on `main` is supported. There is no LTS branch at
this stage of the product.
