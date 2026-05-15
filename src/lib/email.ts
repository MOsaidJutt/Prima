import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = process.env.EMAIL_FROM ?? 'Prima <noreply@prima.app>'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

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

  return resend.emails.send({
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

  return resend.emails.send({
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

  return resend.emails.send({
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

  return resend.emails.send({
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

  return resend.emails.send({
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

  return resend.emails.send({
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
