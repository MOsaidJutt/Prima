import { Worker } from 'bullmq'
import { redisConnection } from '@/lib/redis'
import {
  sendReminderForInvoice,
  runPaymentReminderSweep,
  type ReminderJob,
} from '@/lib/jobs/payment-reminder'

export function startPaymentReminderWorker() {
  return new Worker<Partial<ReminderJob>>(
    'payment-reminder',
    async (job) => {
      // A job carrying an invoiceId sends that one reminder (ad-hoc/manual
      // sends); an empty job is the daily cron and runs the full sweep.
      if (job.data?.invoiceId) {
        await sendReminderForInvoice(job.data as ReminderJob)
      } else {
        await runPaymentReminderSweep()
      }
    },
    { connection: redisConnection, concurrency: 5 }
  )
}
