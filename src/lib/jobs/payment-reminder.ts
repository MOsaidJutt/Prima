import { prisma } from '@/lib/prisma'
import { sendPaymentReminderEmail } from '@/lib/email'
import { startOfDay, endOfDay, subDays } from 'date-fns'

/** Reminder schedule relative to an invoice due date: 3 days before, on the day, then 7/14/30 days overdue. */
export const REMINDER_OFFSETS = [-3, 0, 7, 14, 30] as const

export interface ReminderJob {
  invoiceId: string
  organizationId: string
  daysOffset: number
  scheduledAt: string
}

const SKIP_STATUSES = ['PAID', 'CANCELLED']

/**
 * Sends one reminder for one invoice and records it. Idempotent: a reminder
 * already logged as SENT for the same invoice + offset is never sent twice, so
 * a cron that fires more than once in a day cannot double-email a client.
 */
export async function sendReminderForInvoice(job: ReminderJob): Promise<void> {
  const { invoiceId, organizationId, daysOffset } = job

  const alreadySent = await prisma.paymentReminder.findFirst({
    where: { organizationId, invoiceId, daysOffset, status: 'SENT' },
    select: { id: true },
  })
  if (alreadySent) return

  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, organizationId, deletedAt: null },
    include: {
      client: { select: { companyName: true, contactName: true, email: true } },
      organization: { select: { name: true } },
    },
  })

  // Skip if already paid / cancelled
  if (!invoice || SKIP_STATUSES.includes(invoice.status)) {
    console.log(`[payment-reminder] Skipping ${invoiceId} — status: ${invoice?.status}`)
    return
  }
  if (!invoice.client.email) {
    console.log(`[payment-reminder] Skipping ${invoiceId} — no client email`)
    return
  }

  const balance = Number(invoice.grandTotal) - Number(invoice.paidAmount)

  await sendPaymentReminderEmail({
    to: invoice.client.email,
    clientName: invoice.client.contactName ?? invoice.client.companyName,
    orgName: invoice.organization.name,
    invoiceNumber: invoice.invoiceNumber,
    balance,
    dueDate: invoice.dueDate ?? undefined,
    daysOffset,
  })

  // Log reminder
  await prisma.paymentReminder.create({
    data: {
      organizationId,
      invoiceId,
      channel: 'EMAIL',
      scheduledAt: new Date(job.scheduledAt),
      sentAt: new Date(),
      status: 'SENT',
      daysOffset,
    },
  })

  console.log(
    `[payment-reminder] Sent reminder for ${invoice.invoiceNumber} (offset ${daysOffset})`
  )
}

/**
 * Daily sweep: for each offset, finds every unpaid invoice whose due date lands
 * exactly `offset` days from today and sends that reminder.
 *
 * This replaces per-invoice delayed BullMQ jobs. Deriving the work from invoice
 * due dates means reminders survive a Redis flush and do not need a persistent
 * worker process — see docs/DEPLOYMENT.md.
 */
export async function runPaymentReminderSweep(now: Date = new Date()): Promise<void> {
  let sent = 0

  for (const offset of REMINDER_OFFSETS) {
    // A reminder at `offset` fires when dueDate + offset === today,
    // i.e. dueDate === today - offset.
    const dueDay = subDays(now, offset)

    const invoices = await prisma.invoice.findMany({
      where: {
        deletedAt: null,
        status: { notIn: ['PAID', 'CANCELLED', 'DRAFT'] },
        dueDate: { gte: startOfDay(dueDay), lte: endOfDay(dueDay) },
      },
      select: { id: true, organizationId: true },
    })

    for (const invoice of invoices) {
      try {
        await sendReminderForInvoice({
          invoiceId: invoice.id,
          organizationId: invoice.organizationId,
          daysOffset: offset,
          scheduledAt: startOfDay(now).toISOString(),
        })
        sent++
      } catch (err) {
        console.error(`[payment-reminder] invoice ${invoice.id} (offset ${offset}) failed:`, err)
      }
    }
  }

  console.log(`[payment-reminder] Sweep complete — ${sent} invoices processed`)
}
