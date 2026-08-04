import { Queue } from 'bullmq'
import { redisConnection } from '@/lib/redis'

export const emailQueue = new Queue('email', { connection: redisConnection })
export const invoiceOverdueQueue = new Queue('invoice-overdue', { connection: redisConnection })
export const paymentReminderQueue = new Queue('payment-reminder', { connection: redisConnection })
export const performanceSnapshotQueue = new Queue('performance-snapshot', {
  connection: redisConnection,
})
export const matviewRefreshQueue = new Queue('matview-refresh', { connection: redisConnection })

// Payment reminders are no longer scheduled as per-invoice delayed jobs. The
// daily sweep in src/lib/jobs/payment-reminder.ts derives them from invoice due
// dates instead, so reminders survive a Redis flush and work without a
// persistent worker process. The queue above remains for ad-hoc/manual sends.
