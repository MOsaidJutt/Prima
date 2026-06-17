import { NextRequest, NextResponse } from 'next/server'
import { Webhook } from 'svix'
import { suppressEmail } from '@/lib/email-suppression'

// Resend delivers webhooks via Svix. Configure the endpoint URL + these
// event types in the Resend dashboard (Webhooks tab): email.bounced,
// email.complained. See docs/EMAIL_DELIVERABILITY.md.
type ResendWebhookEvent = {
  type: string
  data: {
    to?: string[]
    email_id?: string
    bounce?: { type?: string; subType?: string; message?: string }
  }
}

export async function POST(req: NextRequest) {
  const secret = process.env.RESEND_WEBHOOK_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'Resend webhooks are not configured.' }, { status: 503 })
  }

  const payload = await req.text()
  const svixId = req.headers.get('svix-id')
  const svixTimestamp = req.headers.get('svix-timestamp')
  const svixSignature = req.headers.get('svix-signature')

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: 'Missing signature headers' }, { status: 400 })
  }

  let event: ResendWebhookEvent
  try {
    const wh = new Webhook(secret)
    event = wh.verify(payload, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as ResendWebhookEvent
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const recipient = event.data.to?.[0]

  switch (event.type) {
    case 'email.bounced':
      if (recipient) {
        // Resend fires this for both hard and soft bounces; suppressing on
        // any bounce is the conservative choice that protects sender
        // reputation — false positives just mean a manual resend later.
        await suppressEmail(recipient, 'BOUNCED', event.data.bounce?.message)
      }
      break
    case 'email.complained':
      if (recipient) {
        await suppressEmail(recipient, 'COMPLAINED')
      }
      break
    default:
      // delivered / opened / clicked / etc. — no suppression action needed
      break
  }

  return NextResponse.json({ received: true })
}
