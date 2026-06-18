# Backup & Disaster Recovery

## Database

Prima's database runs on Neon. Neon takes continuous backups automatically
and supports point-in-time restore (PITR); the retention window depends on
your Neon plan (verify the current plan's retention period in the Neon
dashboard before launch, since this is configured at the infrastructure
level, not in application code).

**Before launch, verify in the Neon dashboard:**

- [ ] PITR is enabled and the retention window meets your recovery point
      objective (we recommend at least 7 days).
- [ ] Billing plan supports the retention window you actually need.

### Restore procedure (test this before launch, and again quarterly)

1. In the Neon console, open the project and go to **Branches**.
2. Create a new branch from a specific point in time (Neon lets you pick a
   timestamp or an LSN). This creates an isolated copy; it does not touch
   the live database.
3. Point a local `.env` at the restored branch's connection string and run
   `npx prisma migrate deploy` to confirm the schema is intact, then spot
   check a few tables (`Organization`, `User`, `DsrEntry`) for the expected
   row counts.
4. If the restore is correct and you need to promote it to production,
   follow Neon's branch-to-primary promotion flow, or update `DATABASE_URL`
   in Vercel to point at the restored branch and redeploy.
5. Record the time the drill took. That number is your actual recovery
   time objective, not an estimate.

## File storage (Cloudflare R2)

Org uploads (product images, logos, invoice attachments) live in R2.

**Before launch:**

- [ ] Enable bucket versioning in the Cloudflare dashboard for the R2
      bucket named in `R2_BUCKET_NAME`, so an accidental overwrite or
      delete can be recovered from a previous version.
- [ ] Confirm lifecycle rules (if any) don't expire versions sooner than
      your retention requirement.

## Redis

Redis (Upstash in production) holds BullMQ job queues and dashboard
caches. Nothing in Redis is the source of truth: queues can be replayed
from the cron schedules in `src/lib/workers/index.ts`, and caches
repopulate from Postgres on the next request. Redis does not need a backup
procedure; if it is lost, the worst case is a burst of cache misses and any
in-flight jobs need to be re-triggered manually.

## What is NOT backed up automatically

- Locally-set environment variables and secrets. Keep a copy in a secrets
  manager or password vault, not just in Vercel's dashboard.
- Stripe and Resend configuration (webhook endpoints, signing secrets).
  These are recreated through each provider's own dashboard if needed and
  are documented in `docs/DEPLOYMENT.md`.
