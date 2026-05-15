import { Worker } from 'bullmq'
import { redisConnection } from '@/lib/redis'
import { prisma } from '@/lib/prisma'
import { sendPaymentReminderEmail } from '@/lib/email'

interface ReminderJob {
  invoiceId: string
  organizationId: string
  daysOffset: number
  scheduledAt: string
}

export function startPaymentReminderWorker() {
  return new Worker<ReminderJob>(
    'payment-reminder',
    async (job) => {
      const { invoiceId, organizationId, daysOffset } = job.data

      const invoice = await prisma.invoice.findFirst({
        where: { id: invoiceId, organizationId, deletedAt: null },
        include: {
          client: { select: { companyName: true, contactName: true, email: true } },
          organization: { select: { name: true } },
        },
      })

      // Skip if already paid / cancelled
      if (!invoice || ['PAID', 'CANCELLED'].includes(invoice.status)) {
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
          scheduledAt: new Date(job.data.scheduledAt),
          sentAt: new Date(),
          status: 'SENT',
          daysOffset,
        },
      })

      console.log(
        `[payment-reminder] Sent reminder for ${invoice.invoiceNumber} (offset ${daysOffset})`
      )
    },
    { connection: redisConnection, concurrency: 5 }
  )
}
