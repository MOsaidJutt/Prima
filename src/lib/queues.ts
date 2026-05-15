import { Queue } from 'bullmq'
import { redisConnection } from '@/lib/redis'

export const emailQueue = new Queue('email', { connection: redisConnection })
export const invoiceOverdueQueue = new Queue('invoice-overdue', { connection: redisConnection })
export const paymentReminderQueue = new Queue('payment-reminder', { connection: redisConnection })
export const performanceSnapshotQueue = new Queue('performance-snapshot', {
  connection: redisConnection,
})

// Schedule payment reminders for the 5 standard intervals around invoice due date
// daysOffset: -3 (3 days before), 0 (on due day), +7, +14, +30 (days overdue)
export async function schedulePaymentReminders(
  invoiceId: string,
  dueDate: Date,
  organizationId: string
) {
  const offsets = [-3, 0, 7, 14, 30]
  for (const offset of offsets) {
    const scheduledAt = new Date(dueDate.getTime() + offset * 24 * 60 * 60 * 1000)
    const delay = scheduledAt.getTime() - Date.now()
    if (delay < 0) continue // skip past dates

    await paymentReminderQueue.add(
      'send-reminder',
      { invoiceId, organizationId, daysOffset: offset, scheduledAt: scheduledAt.toISOString() },
      {
        delay,
        jobId: `reminder-${invoiceId}-${offset}`,
        removeOnComplete: true,
        removeOnFail: 100,
      }
    )
  }
}
