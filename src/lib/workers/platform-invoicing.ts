import { Worker, Queue } from 'bullmq'
import { redisConnection } from '@/lib/redis'
import { runPlatformInvoicing } from '@/lib/jobs/platform-invoicing'

export const platformInvoiceQueue = new Queue('platform-invoicing', { connection: redisConnection })

export function startPlatformInvoiceWorker() {
  return new Worker('platform-invoicing', async () => runPlatformInvoicing(), {
    connection: redisConnection,
    concurrency: 1,
  })
}
