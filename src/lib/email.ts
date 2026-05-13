import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = process.env.EMAIL_FROM ?? 'Prima <noreply@prima.app>'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

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
    html: `
      <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;padding:24px">
        <h1 style="color:#6366F1;font-size:24px;margin-bottom:8px">Welcome to Prima</h1>
        <p style="color:#374151;font-size:16px">Hi${adminName ? ` ${adminName}` : ''},</p>
        <p style="color:#374151;font-size:16px">
          You've been invited to set up your organisation <strong>${orgName}</strong> on Prima —
          the intelligent DSR & sales management platform.
        </p>
        <a href="${link}" style="display:inline-block;background:#6366F1;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin:16px 0">
          Accept Invitation & Set Password
        </a>
        <p style="color:#6B7280;font-size:14px">This link expires in 48 hours.</p>
        <hr style="border:none;border-top:1px solid #E5E7EB;margin:24px 0"/>
        <p style="color:#9CA3AF;font-size:12px">Prima · Intelligent Sales Management</p>
      </div>
    `,
  })
}

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
    html: `
      <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;padding:24px">
        <h1 style="color:#6366F1;font-size:24px">Password Reset</h1>
        <p style="color:#374151">Hi${name ? ` ${name}` : ''},</p>
        <p style="color:#374151">Click below to reset your password. This link expires in 1 hour.</p>
        <a href="${link}" style="display:inline-block;background:#6366F1;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin:16px 0">
          Reset Password
        </a>
        <p style="color:#6B7280;font-size:14px">If you didn't request this, ignore this email.</p>
      </div>
    `,
  })
}
