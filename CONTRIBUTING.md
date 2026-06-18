# Contributing to Prima

## Local setup

See the README for full environment setup. The short version:

```bash
npm install
cp .env.example .env        # fill in DATABASE_URL, REDIS_URL at minimum
npx prisma migrate dev
npx tsx prisma/seed.ts
npm run dev
```

## Before opening a PR

Run the same checks CI runs:

```bash
npm run typecheck
npm run lint
npx vitest run
```

A pre-commit hook (`husky` + `lint-staged`) auto-fixes lint and formatting
on staged `.ts`/`.tsx`/`.json`/`.md`/`.css` files, but it won't catch
type errors or test failures, so run the commands above before pushing.

If your change touches a Prisma model, generate a migration rather than
using `db push`:

```bash
npx prisma migrate dev --name describe_the_change
```

`db push` is fine for local experimentation but its drift is not captured
in `prisma/migrations/`, which is what `migrate deploy` runs in production.

## Commit messages

Use a short imperative summary line, optionally with a `feat:`/`fix:`/
`chore:`/`refactor:` prefix matching the existing git history. Explain
_why_ in the body when the change isn't self-evident from the diff.

## Code conventions

- TypeScript strict mode is on. Don't add `any` to work around a type
  error; fix the type.
- Every `/api/v1/*` route is tenant-scoped. New routes should go through
  `withTenantApi` (`src/lib/api-helpers.ts`) rather than reading
  `organizationId` ad hoc, so tenant isolation and Sentry tagging stay
  consistent.
- New database fields containing financial identifiers (account numbers,
  tax IDs, etc.) should go through the PII encryption extension in
  `src/lib/prisma.ts` and `src/lib/crypto.ts`, not be stored as plaintext.
- UI components use shadcn/ui primitives (`src/components/ui/`) and the
  existing design tokens in `src/app/globals.css`. Don't hardcode hex
  colors in new components.
- Translatable user-facing strings go through `next-intl`
  (`useTranslations`/`getTranslations`), with English strings added to
  `messages/en.json`.

## Tests

- Unit/integration tests live in `src/test/*.test.ts` (Vitest). Tests that
  need a real database are tagged and skipped via `SKIP_INTEGRATION_TESTS`
  when no test database is configured.
- E2E tests live in `tests/e2e/` (Playwright) and run against a real
  running app instance.

## Reporting a security issue

Do not open a public issue. See `SECURITY.md`.
