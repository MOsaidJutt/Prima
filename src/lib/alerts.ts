import { sendOpsAlertEmail } from '@/lib/email'

export type AlertSeverity = 'info' | 'warning' | 'critical'

/**
 * On-call alert routing (Phase 7 monitoring). Email always fires if
 * ONCALL_ALERT_EMAIL is set; WhatsApp via Twilio is best-effort and silently
 * skipped if the Twilio env vars aren't configured — this lets alerting work
 * in any environment without requiring a live Twilio account.
 */
export async function sendOnCallAlert(
  subject: string,
  body: string,
  severity: AlertSeverity = 'warning'
) {
  await Promise.allSettled([
    sendOpsAlertEmail({ subject: `[${severity.toUpperCase()}] ${subject}`, body }),
    sendWhatsAppAlert(`[${severity.toUpperCase()}] ${subject}\n${body}`),
  ])
}

async function sendWhatsAppAlert(message: string) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const from = process.env.TWILIO_WHATSAPP_FROM // e.g. 'whatsapp:+14155238886'
  const to = process.env.ONCALL_WHATSAPP_TO // e.g. 'whatsapp:+923001234567'
  if (!accountSid || !authToken || !from || !to) return

  const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64')
  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ From: from, To: to, Body: message }),
      }
    )
    if (!res.ok) {
      console.error('[alerts] Twilio WhatsApp send failed', res.status, await res.text())
    }
  } catch (err) {
    console.error('[alerts] Twilio WhatsApp send failed', err)
  }
}
