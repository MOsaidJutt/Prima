import { Worker } from 'bullmq'
import { redisConnection } from '@/lib/redis'
import { prisma } from '@/lib/prisma'

// Marks ISSUED invoices as OVERDUE when they are past their due date.
// Triggered by a daily cron via invoiceOverdueQueue.add(... { repeat: { cron: '0 1 * * *' } })
export function startInvoiceOverdueWorker() {
  return new Worker(
    'invoice-overdue',
    async () => {
      const now = new Date()
      const result = await prisma.invoice.updateMany({
        where: {
          status: 'ISSUED',
          dueDate: { lt: now },
          deletedAt: null,
        },
        data: { status: 'OVERDUE' },
      })
      console.log(`[invoice-overdue] Marked ${result.count} invoices as OVERDUE`)
    },
    { connection: redisConnection, concurrency: 1 }
  )
}
