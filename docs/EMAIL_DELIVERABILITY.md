# Email Deliverability

Prima sends transactional email (invites, invoices, payment receipts,
subscription lifecycle notices) via [Resend](https://resend.com). This doc
covers domain authentication, the bounce/complaint handling built in Phase 7,
and the manual rendering checks to run before launch.

## 1. Domain authentication (SPF, DKIM, DMARC)

Done once per sending domain, in the Resend dashboard under **Domains**:

1. Add the sending domain (e.g. `prima.app`) in Resend.
2. Resend generates the DNS records to add at your registrar/DNS host:
   - **SPF** — a `TXT` record on the root domain authorizing Resend's
     servers to send on your behalf (usually merged into an existing SPF
     record if one exists — a domain can only have one SPF record).
   - **DKIM** — one or more `CNAME`/`TXT` records (Resend signs outgoing mail
     with the corresponding private key).
   - **DMARC** — a `TXT` record at `_dmarc.<domain>` declaring the policy
     (start with `p=none` to monitor, move to `p=quarantine` then
     `p=reject` once SPF/DKIM are verified passing in reports).
3. Wait for DNS propagation, then click **Verify** in Resend. All three must
   show green before sending real traffic — unauthenticated domains get
   spam-folder'd or outright rejected by Gmail/Outlook at volume.
4. Set `EMAIL_FROM` in production env vars to an address on the verified
   domain (e.g. `Prima <noreply@prima.app>`) — sending from an unverified
   domain silently degrades deliverability even if SPF passes for a
   different domain.

## 2. Bounce & complaint handling (Phase 7)

Resend delivers bounce/complaint events as [Svix](https://www.svix.com/)-signed
webhooks. Prima listens at `POST /api/webhooks/resend`
(`src/app/api/webhooks/resend/route.ts`):

- **Setup**: Resend dashboard → **Webhooks** → add endpoint
  `https://<your-domain>/api/webhooks/resend`, subscribe to `email.bounced`
  and `email.complained`, copy the **Signing Secret** into
  `RESEND_WEBHOOK_SECRET`.
- **Behavior**: on either event, the recipient address is upserted into the
  `EmailSuppression` table (global, not per-org — protects the sending
  domain's reputation regardless of which tenant triggered the send).
- **Enforcement**: every one of the 13 send functions in `src/lib/email.ts`
  routes through a shared `sendEmail()` wrapper that checks
  `isEmailSuppressed()` first and silently skips the send (logging a
  warning) if the address is on the list. No per-call-site changes needed
  for future email functions — just call `sendEmail()` instead of
  `resend.emails.send()` directly.
- **Un-suppressing**: there's no UI for this yet (low volume expected
  pre-launch) — delete the row from `EmailSuppression` via `prisma studio`
  or a direct query if a customer's bounce was a transient mail-server
  issue and they ask to be re-enabled.

## 3. Manual render checks (run before launch, and after any template change)

Send each of these to a real Gmail, Outlook (outlook.com or M365), and Apple
Mail address and visually check rendering (dark mode too, where supported):

- [ ] Organization invite (`sendOrganizationInvite`)
- [ ] User invite (`sendUserInvite`)
- [ ] Password reset (`sendPasswordReset`)
- [ ] Invoice email with PDF attachment (`sendInvoiceEmail`)
- [ ] Payment receipt (`sendPaymentReceiptEmail`)
- [ ] Subscription confirmation (`sendSubscriptionConfirmationEmail`)
- [ ] Trial ending reminder (`sendTrialEndingEmail`)

Things to check specifically: preheader text shows in the inbox preview,
the CTA button is clickable (not stripped by Outlook's HTML sanitizer),
currency amounts render correctly (see `src/lib/format.ts` for the
org-locale-aware formatter introduced in Phase 7), and no broken images
(logo URLs must be absolute, publicly reachable R2 URLs — not relative paths).

## 4. Monitoring

- Resend's own dashboard shows delivery/bounce/complaint rates per domain —
  check this weekly post-launch; a complaint rate above ~0.1% risks
  throttling from receiving providers.
- Suppressed addresses accumulate in `EmailSuppression` — a growing BOUNCED
  count for a single domain (e.g. many `@client-co.com` addresses bouncing)
  usually means that company's mail server is blocking Prima, not a Resend
  problem — worth a manual check before assuming the suppression list itself
  is the issue.
