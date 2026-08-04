import { Worker } from 'bullmq'
import { redisConnection } from '@/lib/redis'
import { runInvoiceOverdue } from '@/lib/jobs/invoice-overdue'

// Marks ISSUED invoices as OVERDUE when they are past their due date.
// Job body lives in @/lib/jobs so it can also run from the cron HTTP route
// (src/app/api/cron/[job]/route.ts) without a persistent worker process.
export function startInvoiceOverdueWorker() {
  return new Worker('invoice-overdue', async () => runInvoiceOverdue(), {
    connection: redisConnection,
    concurrency: 1,
  })
}
