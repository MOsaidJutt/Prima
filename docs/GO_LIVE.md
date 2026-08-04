# Go Live

The ordered list of steps to put Prima in production on free-tier
infrastructure. Everything here needs account access or DNS control, so these
are all manual steps. Work top to bottom — later steps depend on earlier ones.

Target stack: **Vercel Hobby + Neon + Upstash + Cloudflare R2 + Resend +
Stripe + cron-job.org**. Running cost: $0 plus the domain (~$10/yr) and
Stripe's per-transaction fee.

> **Read this before you start.** Vercel's Hobby plan prohibits commercial use,
> and Prima charges customers. This stack is fine for validating with your
> first users, but move to Vercel Pro ($20/mo) or a self-hosted box before you
> are meaningfully commercial. Nothing in the code changes when you do — see
> `docs/DEPLOYMENT.md`.

## 0. What you need first

- A domain (Namecheap, Cloudflare Registrar, etc.)
- The GitHub repo pushed to `main` — already done
- Your Neon database

Tenants are resolved from the logged-in user's session, **not** from a
subdomain, so a single domain is enough. No wildcard DNS required.

## 1. Provision the services (~30 min)

Create each account, then keep the credentials somewhere safe — you paste them
all into Vercel in step 4.

| Service                                      | Plan         | What to create                                | Values you need                                                                                        |
| -------------------------------------------- | ------------ | --------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| [Upstash](https://upstash.com)               | Free         | A Redis database                              | `REDIS_URL` (the `rediss://` one), `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`                |
| [Cloudflare R2](https://dash.cloudflare.com) | Free (10 GB) | A bucket + an API token                       | `CLOUDFLARE_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL` |
| [Resend](https://resend.com)                 | Free (3k/mo) | An API key + add your domain                  | `RESEND_API_KEY`, `EMAIL_FROM`                                                                         |
| [Stripe](https://stripe.com)                 | Pay-per-use  | Nothing yet — just the keys, in **test mode** | `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`                                              |
| [Sentry](https://sentry.io)                  | Free         | A Next.js project                             | `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_AUTH_TOKEN`                                                          |
| [PostHog](https://posthog.com)               | Free         | A project                                     | `NEXT_PUBLIC_POSTHOG_KEY`                                                                              |

Sentry and PostHog are optional — the app runs without them, you just lose
error tracking and analytics.

**Resend domain verification:** add the SPF, DKIM, and DMARC DNS records Resend
shows you. Until the domain verifies, transactional email will not deliver.
Details in `docs/EMAIL_DELIVERABILITY.md`.

## 2. Generate secrets

Four values you invent rather than copy. Run this four times:

```bash
openssl rand -hex 32
```

Assign the output to `BETTER_AUTH_SECRET`, `ENCRYPTION_MASTER_KEY`,
`PII_ENCRYPTION_KEY`, and `CRON_SECRET`.

> **`ENCRYPTION_MASTER_KEY` and `PII_ENCRYPTION_KEY` can never change once real
> data exists.** They decrypt stored NTN/STRN, bank account, and IBAN fields.
> Losing or rotating them makes that data unreadable. Store them somewhere you
> will still have in a year — a password manager, not a terminal scrollback.

## 3. Prepare the database

Run these locally, pointed at production. Replace the URL with your Neon
connection string:

```bash
export DATABASE_URL="postgresql://...neon.tech/...?sslmode=require"

# The seed creates your Super Admin from these two values — set them to what
# you actually want, not the .env.example defaults.
export SUPER_ADMIN_EMAIL="you@yourdomain.com"
export SUPER_ADMIN_PASSWORD="<a strong, unique password>"

npx prisma migrate deploy   # applies all migrations, incl. the pending
                            # phase7_email_suppression one
npx prisma db seed          # billing plans, top-up packs, coupons, super admin
```

`migrate deploy` also enables the `vector` extension that the AI layer needs.

Confirm it worked:

```bash
npx prisma migrate status   # should report no pending migrations
```

## 4. Deploy to Vercel

1. Import the GitHub repo at [vercel.com/new](https://vercel.com/new). The
   Next.js preset and default build command are correct.
2. Add every environment variable from steps 1–3 to the **Production**
   environment. The full annotated list is in `.env.example`; the deployment
   notes are in `docs/DEPLOYMENT.md` §1.
3. Set `NEXT_PUBLIC_APP_URL` and `BETTER_AUTH_URL` to your real domain
   (`https://yourdomain.com`). These drive email links, `sitemap.xml`, and
   `robots.txt` — a wrong value here sends customers to the wrong host.
4. Deploy.
5. Add your custom domain under Settings → Domains and point DNS as Vercel
   instructs. SSL is provisioned automatically.

## 5. Wire the webhooks

Both need the live URL, so they come after the domain works.

**Stripe** → Developers → Webhooks → Add endpoint:

- URL: `https://yourdomain.com/api/webhooks/stripe`
- Events: `payment_intent.succeeded`, `payment_intent.payment_failed`,
  `setup_intent.succeeded` — these are the three the handler implements
- Copy the signing secret into `STRIPE_WEBHOOK_SECRET` in Vercel, then redeploy.

**Resend** → Webhooks → Add endpoint:

- URL: `https://yourdomain.com/api/webhooks/resend`
- Events: bounces and complaints
- Copy the signing secret into `RESEND_WEBHOOK_SECRET`, then redeploy.

## 6. Schedule the jobs

Nine jobs, all free on [cron-job.org](https://cron-job.org). For each one:

- URL: `https://yourdomain.com/api/cron/<job>`
- Method: GET
- Custom header: `x-cron-secret: <your CRON_SECRET>`
- Schedule: from the table in `docs/DEPLOYMENT.md` §2 (all times UTC)

Verify one by hand before trusting the schedule:

```bash
curl -H "x-cron-secret: $CRON_SECRET" https://yourdomain.com/api/cron/invoice-overdue
# {"job":"invoice-overdue","status":"ok","durationMs":123}
```

A 401 means the header is wrong; a 503 means `CRON_SECRET` is not set in Vercel.

## 7. Smoke test

Do this yourself before inviting anyone:

1. Visit `/` — marketing site loads.
2. Log in at `/super-admin/login` with the credentials you seeded in step 3.
3. Create a test organization from the Super Admin panel.
4. Log in as that org's owner. Create a product, a client, submit a DSR,
   approve it, issue an invoice.
5. Confirm the invoice email arrives (checks Resend end to end).
6. Run a subscription payment with Stripe test card `4242 4242 4242 4242`.
7. Check Sentry for errors from the last 15 minutes.

## 8. Flip Stripe to live

Only after step 7 passes cleanly:

1. Swap `STRIPE_SECRET_KEY` and `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` for the
   live-mode keys.
2. Recreate the webhook endpoint in live mode — it has a **different** signing
   secret. Update `STRIPE_WEBHOOK_SECRET`.
3. Redeploy.
4. Delete the test organization, or keep it clearly marked as a demo.

## 9. After launch

- Add an uptime monitor against the domain (`docs/MONITORING.md`)
- Confirm your Neon plan's PITR retention and do one restore drill
  (`docs/BACKUP_AND_DR.md`)
- Enable R2 bucket versioning
- Run Lighthouse against the live URL
- Work through anything still unchecked in `docs/LAUNCH_CHECKLIST.md`

Queue-depth alerting does not run on this stack — it inspects BullMQ state,
which only exists when the persistent worker is running. Sentry still reports
job failures from the cron route.
