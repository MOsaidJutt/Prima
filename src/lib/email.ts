import { Resend } from 'resend'
import { isEmailSuppressed } from '@/lib/email-suppression'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = process.env.EMAIL_FROM ?? 'Prima <noreply@prima.app>'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

// Phase 7: every send goes through here so the bounce/complaint suppression
// list (populated by /api/webhooks/resend) is enforced in one place, rather
// than at each of the 13 call sites below.
async function sendEmail(payload: Parameters<typeof resend.emails.send>[0]) {
  const to = Array.isArray(payload.to) ? payload.to[0] : payload.to
  if (to && (await isEmailSuppressed(to))) {
    console.warn(`[email] skipped send to suppressed address: ${to}`)
    return { data: null, error: null }
  }
  return resend.emails.send(payload)
}

// ── Super Admin → Tenant Admin invitation ─────────────────────────────────────

export async function sendOrganizationInvite({
  to,
  orgName,
  inviteToken,
  adminName,
}: {
  to: string
  orgName: string
  inviteToken: string
  adminName?: string
}) {
  const link = `${APP_URL}/onboarding/accept?token=${inviteToken}`

  return sendEmail({
    from: FROM,
    to,
    subject: `You've been invited to set up ${orgName} on Prima`,
    html: emailHtml({
      heading: 'Welcome to Prima',
      preheader: `Set up your ${orgName} workspace`,
      body: `Hi${adminName ? ` ${adminName}` : ''},<br/><br/>
        You've been invited to set up your organisation <strong>${orgName}</strong> on Prima —
        the intelligent DSR &amp; sales management platform.`,
      ctaText: 'Accept Invitation &amp; Set Password',
      ctaHref: link,
      footer: "This link expires in 48 hours. If you didn't expect this, ignore this email.",
    }),
  })
}

// ── Tenant Admin → Team Member invitation ─────────────────────────────────────

export async function sendUserInvite({
  to,
  orgName,
  inviteToken,
  inviterName,
  roleName,
}: {
  to: string
  orgName: string
  inviteToken: string
  inviterName?: string
  roleName?: string
}) {
  const link = `${APP_URL}/invite/accept?token=${inviteToken}`

  return sendEmail({
    from: FROM,
    to,
    subject: `You've been invited to join ${orgName} on Prima`,
    html: emailHtml({
      heading: `Join ${orgName}`,
      preheader: `${inviterName ?? 'Your team'} has invited you to Prima`,
      body: `Hi,<br/><br/>
        ${inviterName ? `<strong>${inviterName}</strong> has` : "You've been"} invited you to join
        <strong>${orgName}</strong> on Prima${roleName ? ` as a <strong>${roleName}</strong>` : ''}.
        <br/><br/>Click below to set your password and activate your account.`,
      ctaText: 'Accept Invitation',
      ctaHref: link,
      footer: "This link expires in 48 hours. If you didn't expect this, contact your team admin.",
    }),
  })
}

// ── Password reset ────────────────────────────────────────────────────────────

export async function sendPasswordReset({
  to,
  resetToken,
  name,
}: {
  to: string
  resetToken: string
  name?: string
}) {
  const link = `${APP_URL}/reset-password?token=${resetToken}`

  return sendEmail({
    from: FROM,
    to,
    subject: 'Reset your Prima password',
    html: emailHtml({
      heading: 'Reset Password',
      preheader: 'Reset your Prima account password',
      body: `Hi${name ? ` ${name}` : ''},<br/><br/>
        We received a request to reset your Prima password. Click below to choose a new one.`,
      ctaText: 'Reset Password',
      ctaHref: link,
      footer: "This link expires in 1 hour. If you didn't request a reset, ignore this email.",
    }),
  })
}

// ── Invoice email ─────────────────────────────────────────────────────────────

export async function sendInvoiceEmail({
  to,
  clientName,
  orgName,
  invoiceNumber,
  grandTotal,
  dueDate,
  invoiceUrl,
}: {
  to: string
  clientName: string
  orgName: string
  invoiceNumber: string
  grandTotal: number
  dueDate?: Date
  invoiceUrl: string
}) {
  const dueLine = dueDate
    ? `<br/>Payment is due by <strong>${dueDate.toLocaleDateString('en-PK')}</strong>.`
    : ''

  return sendEmail({
    from: FROM,
    to,
    subject: `Invoice ${invoiceNumber} from ${orgName}`,
    html: emailHtml({
      heading: `Invoice ${invoiceNumber}`,
      preheader: `You have a new invoice of PKR ${grandTotal.toLocaleString()} from ${orgName}`,
      body: `Hi ${clientName},<br/><br/>
        Please find your invoice <strong>${invoiceNumber}</strong> from <strong>${orgName}</strong>.<br/>
        <strong>Amount Due: PKR ${grandTotal.toLocaleString()}</strong>${dueLine}`,
      ctaText: 'View Invoice',
      ctaHref: invoiceUrl,
      footer: 'If you have any questions about this invoice, please contact us.',
    }),
  })
}

// ── Payment receipt ───────────────────────────────────────────────────────────

export async function sendPaymentReceiptEmail({
  to,
  clientName,
  orgName,
  invoiceNumber,
  amount,
  paymentDate,
  method,
  balance,
}: {
  to: string
  clientName: string
  orgName: string
  invoiceNumber: string
  amount: number
  paymentDate: Date
  method: string
  balance: number
}) {
  const balanceLine =
    balance > 0.01
      ? `<br/>Remaining balance: <strong>PKR ${balance.toLocaleString()}</strong>`
      : '<br/><strong>Invoice is now fully paid. Thank you!</strong>'

  return sendEmail({
    from: FROM,
    to,
    subject: `Payment received for Invoice ${invoiceNumber}`,
    html: emailHtml({
      heading: 'Payment Received',
      preheader: `Payment of PKR ${amount.toLocaleString()} received`,
      body: `Hi ${clientName},<br/><br/>
        We have received your payment of <strong>PKR ${amount.toLocaleString()}</strong>
        on ${paymentDate.toLocaleDateString('en-PK')} via ${method}
        for Invoice <strong>${invoiceNumber}</strong>.${balanceLine}`,
      ctaText: 'View Invoice',
      ctaHref: `${APP_URL}/admin/invoices`,
      footer: `Issued by ${orgName}. Thank you for your business.`,
    }),
  })
}

// ── Payment reminder ──────────────────────────────────────────────────────────

export async function sendPaymentReminderEmail({
  to,
  clientName,
  orgName,
  invoiceNumber,
  balance,
  dueDate,
  daysOffset,
}: {
  to: string
  clientName: string
  orgName: string
  invoiceNumber: string
  balance: number
  dueDate?: Date
  daysOffset: number
}) {
  const isOverdue = daysOffset > 0
  const isDueToday = daysOffset === 0
  const subject = isOverdue
    ? `OVERDUE: Invoice ${invoiceNumber} — ${daysOffset} days past due`
    : isDueToday
      ? `Payment due today: Invoice ${invoiceNumber}`
      : `Upcoming payment: Invoice ${invoiceNumber} due in ${Math.abs(daysOffset)} days`

  const bodyLine = isOverdue
    ? `Your invoice <strong>${invoiceNumber}</strong> is now <strong>${daysOffset} days overdue</strong>.`
    : isDueToday
      ? `Your invoice <strong>${invoiceNumber}</strong> is due <strong>today</strong>.`
      : `Your invoice <strong>${invoiceNumber}</strong> is due in <strong>${Math.abs(daysOffset)} days</strong>${dueDate ? ` (${dueDate.toLocaleDateString('en-PK')})` : ''}.`

  return sendEmail({
    from: FROM,
    to,
    subject,
    html: emailHtml({
      heading: isOverdue ? 'Payment Overdue' : 'Payment Reminder',
      preheader: subject,
      body: `Hi ${clientName},<br/><br/>
        ${bodyLine}<br/>
        Amount outstanding: <strong>PKR ${balance.toLocaleString()}</strong>`,
      ctaText: 'Pay Now',
      ctaHref: APP_URL,
      footer: `Sent by ${orgName}. Reply to this email if you have any questions.`,
    }),
  })
}

// ── Phase 6: Platform billing ─────────────────────────────────────────────────

export async function sendSubscriptionConfirmationEmail({
  to,
  orgName,
  planName,
  billingCycle,
  amount,
  nextBillingDate,
}: {
  to: string
  orgName: string
  planName: string
  billingCycle: string
  amount: number
  nextBillingDate: Date
}) {
  return sendEmail({
    from: FROM,
    to,
    subject: `Your Prima subscription is active — ${planName}`,
    html: emailHtml({
      heading: 'Subscription Activated',
      preheader: `${orgName} is now on the ${planName} plan`,
      body: `Hi,<br/><br/>
        Thanks for subscribing to Prima! <strong>${orgName}</strong> is now on the
        <strong>${planName}</strong> plan, billed ${billingCycle.toLowerCase()}.<br/><br/>
        Amount charged: <strong>PKR ${amount.toLocaleString()}</strong><br/>
        Next billing date: <strong>${nextBillingDate.toLocaleDateString('en-PK')}</strong>`,
      ctaText: 'View Billing',
      ctaHref: `${APP_URL}/admin/billing`,
      footer:
        'You can manage your subscription, payment methods, and token wallet from your billing page.',
    }),
  })
}

export async function sendPaymentFailedEmail({
  to,
  orgName,
  amount,
  reason,
}: {
  to: string
  orgName: string
  amount: number
  reason?: string
}) {
  return sendEmail({
    from: FROM,
    to,
    subject: `Action required: payment failed for ${orgName}`,
    html: emailHtml({
      heading: 'Payment Failed',
      preheader: "We couldn't process your subscription payment",
      body: `Hi,<br/><br/>
        We were unable to process your subscription payment of
        <strong>PKR ${amount.toLocaleString()}</strong> for <strong>${orgName}</strong>.${reason ? `<br/>Reason: ${reason}` : ''}<br/><br/>
        Please update your payment method to avoid any interruption to your service.
        If this isn't resolved within 7 days, some features (AI tools and exports) will be
        temporarily restricted, and after 14 days your account will be suspended.`,
      ctaText: 'Update Payment Method',
      ctaHref: `${APP_URL}/admin/billing`,
      footer: 'If you believe this is an error, please contact support.',
    }),
  })
}

export async function sendFeatureRestrictedEmail({ to, orgName }: { to: string; orgName: string }) {
  return sendEmail({
    from: FROM,
    to,
    subject: `Features restricted for ${orgName} — payment still pending`,
    html: emailHtml({
      heading: 'Account Features Restricted',
      preheader: 'AI features and exports are now disabled',
      body: `Hi,<br/><br/>
        Your subscription payment for <strong>${orgName}</strong> is still pending.
        AI features and data exports have been temporarily disabled.<br/><br/>
        Please update your payment method now to restore full access.
        If payment is not received within 7 more days, your account will be suspended.`,
      ctaText: 'Update Payment Method',
      ctaHref: `${APP_URL}/admin/billing`,
      footer: 'Your data remains safe — only AI features and exports are affected.',
    }),
  })
}

export async function sendSuspendedEmail({
  to,
  orgName,
  gracePeriodEndsAt,
}: {
  to: string
  orgName: string
  gracePeriodEndsAt: Date
}) {
  return sendEmail({
    from: FROM,
    to,
    subject: `${orgName} has been suspended — payment overdue`,
    html: emailHtml({
      heading: 'Account Suspended',
      preheader: 'Your account is now read-only',
      body: `Hi,<br/><br/>
        Your subscription payment for <strong>${orgName}</strong> has not been received,
        and your account has been suspended. Your account is now read-only — only the
        billing page is accessible.<br/><br/>
        Please settle your outstanding balance by
        <strong>${gracePeriodEndsAt.toLocaleDateString('en-PK')}</strong> to reactivate your
        account. After this date, your data will be exported and scheduled for deletion.`,
      ctaText: 'Reactivate Account',
      ctaHref: `${APP_URL}/admin/billing`,
      footer: 'We hope to have you back soon — reach out if you need help.',
    }),
  })
}

export async function sendGracePeriodReminderEmail({
  to,
  orgName,
  daysRemaining,
  deleteAt,
}: {
  to: string
  orgName: string
  daysRemaining: number
  deleteAt: Date
}) {
  return sendEmail({
    from: FROM,
    to,
    subject: `Reminder: ${orgName} data will be deleted in ${daysRemaining} day${daysRemaining === 1 ? '' : 's'}`,
    html: emailHtml({
      heading: 'Account Suspended — Action Needed',
      preheader: `${daysRemaining} days remaining before data deletion`,
      body: `Hi,<br/><br/>
        Your account <strong>${orgName}</strong> remains suspended due to an outstanding
        balance. You have <strong>${daysRemaining} day${daysRemaining === 1 ? '' : 's'}</strong>
        remaining before your data is permanently deleted on
        <strong>${deleteAt.toLocaleDateString('en-PK')}</strong>.<br/><br/>
        Settle your balance now to reactivate your account and prevent data loss.`,
      ctaText: 'Reactivate Account',
      ctaHref: `${APP_URL}/admin/billing`,
      footer: 'This is an automated reminder sent during your grace period.',
    }),
  })
}

export async function sendTrialEndingEmail({
  to,
  orgName,
  daysRemaining,
}: {
  to: string
  orgName: string
  daysRemaining: number
}) {
  const isLastDay = daysRemaining <= 0
  const subject = isLastDay
    ? `Your Prima trial ends today — ${orgName}`
    : `Your Prima trial ends in ${daysRemaining} day${daysRemaining === 1 ? '' : 's'}`

  return sendEmail({
    from: FROM,
    to,
    subject,
    html: emailHtml({
      heading: isLastDay ? 'Your Trial Ends Today' : 'Your Trial Is Ending Soon',
      preheader: subject,
      body: `Hi,<br/><br/>
        ${
          isLastDay
            ? `Your 14-day free trial of Prima for <strong>${orgName}</strong> ends today.`
            : `Your 14-day free trial of Prima for <strong>${orgName}</strong> ends in
               <strong>${daysRemaining} day${daysRemaining === 1 ? '' : 's'}</strong>.`
        }
        <br/><br/>Choose a plan now to keep using Prima without interruption — your data and
        settings will be preserved.`,
      ctaText: 'Choose a Plan',
      ctaHref: `${APP_URL}/admin/billing`,
      footer: 'Need more time or have questions? Just reply to this email.',
    }),
  })
}

export async function sendPlatformInvoiceEmail({
  to,
  orgName,
  invoiceNumber,
  total,
  periodStart,
  periodEnd,
  pdfBuffer,
}: {
  to: string
  orgName: string
  invoiceNumber: string
  total: number
  periodStart: Date
  periodEnd: Date
  pdfBuffer: Buffer
}) {
  return sendEmail({
    from: FROM,
    to,
    subject: `Your Prima invoice ${invoiceNumber}`,
    html: emailHtml({
      heading: `Invoice ${invoiceNumber}`,
      preheader: `Your Prima invoice for ${periodStart.toLocaleDateString('en-PK')} – ${periodEnd.toLocaleDateString('en-PK')}`,
      body: `Hi,<br/><br/>
        Your Prima invoice for <strong>${orgName}</strong>, covering
        ${periodStart.toLocaleDateString('en-PK')} – ${periodEnd.toLocaleDateString('en-PK')},
        is attached as a PDF.<br/><br/>
        <strong>Total due: PKR ${total.toLocaleString()}</strong>`,
      ctaText: 'View Billing',
      ctaHref: `${APP_URL}/admin/billing`,
      footer: 'Thank you for using Prima.',
    }),
    attachments: [
      {
        filename: `${invoiceNumber}.pdf`,
        content: pdfBuffer,
      },
    ],
  })
}

// ── Shared HTML template ──────────────────────────────────────────────────────

function emailHtml({
  heading,
  preheader,
  body,
  ctaText,
  ctaHref,
  footer,
}: {
  heading: string
  preheader: string
  body: string
  ctaText: string
  ctaHref: string
  footer: string
}): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${heading}</title>
</head>
<body style="margin:0;padding:0;background:#F8FAFC;font-family:'Plus Jakarta Sans',Inter,sans-serif">
  <span style="display:none;max-height:0;overflow:hidden">${preheader}</span>
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAFC;padding:40px 0">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border-radius:8px;border:1px solid #E2E8F0;overflow:hidden">
        <!-- Header -->
        <tr><td style="background:#0F172A;padding:24px 32px">
          <p style="margin:0;color:#FFFFFF;font-size:20px;font-weight:700">Prima</p>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:32px">
          <h1 style="margin:0 0 16px;color:#020617;font-size:22px;font-weight:700">${heading}</h1>
          <p style="margin:0 0 24px;color:#374151;font-size:15px;line-height:1.6">${body}</p>
          <a href="${ctaHref}" style="display:inline-block;background:#0F172A;color:#FFFFFF;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px">${ctaText}</a>
          <p style="margin:24px 0 0;color:#6B7280;font-size:13px;line-height:1.5">${footer}</p>
        </td></tr>
        <!-- Footer -->
        <tr><td style="padding:16px 32px;border-top:1px solid #E2E8F0">
          <p style="margin:0;color:#9CA3AF;font-size:12px">Prima · Intelligent Sales Management · <a href="${APP_URL}" style="color:#9CA3AF">${APP_URL}</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}
