/**
 * BullMQ worker bootstrap.
 * Import this file once in a long-running Node.js process (e.g. a custom server
 * or a dedicated worker entry point).  Do NOT import this file in Next.js
 * edge/serverless routes — workers need a persistent process.
 *
 * Local dev: `tsx src/lib/workers/index.ts`
 * Production: run via a separate Fly.io / Railway / Render worker process
 *             pointing at the same REDIS_URL.
 */

import { invoiceOverdueQueue, performanceSnapshotQueue, matviewRefreshQueue } from '@/lib/queues'
import { startInvoiceOverdueWorker } from './invoice-overdue'
import { startPaymentReminderWorker } from './payment-reminder'
import { startPerformanceSnapshotWorker } from './performance-snapshot'
import { matviewRefreshWorker } from './matview-refresh'

// Start all workers
const overdueWorker = startInvoiceOverdueWorker()
const reminderWorker = startPaymentReminderWorker()
const snapshotWorker = startPerformanceSnapshotWorker()
// matviewRefreshWorker is started on import

// Register recurring cron jobs
async function registerCrons() {
  // Mark overdue invoices every day at 01:00 UTC
  await invoiceOverdueQueue.add(
    'mark-overdue',
    {},
    {
      repeat: { pattern: '0 1 * * *' },
      jobId: 'mark-overdue-cron',
      removeOnComplete: true,
    }
  )

  // Generate performance snapshots every night at 00:30 UTC
  await performanceSnapshotQueue.add(
    'daily-snapshot',
    {},
    {
      repeat: { pattern: '30 0 * * *' },
      jobId: 'daily-snapshot-cron',
      removeOnComplete: true,
    }
  )

  // Refresh materialized views every night at 02:00 UTC
  await matviewRefreshQueue.add(
    'refresh-matviews',
    {},
    {
      repeat: { pattern: '0 2 * * *' },
      jobId: 'matview-refresh-cron',
      removeOnComplete: true,
    }
  )

  console.log('[workers] Cron jobs registered')
}

registerCrons().catch(console.error)

console.log('[workers] All workers started')

// Graceful shutdown
process.on('SIGTERM', async () => {
  await Promise.all([
    overdueWorker.close(),
    reminderWorker.close(),
    snapshotWorker.close(),
    matviewRefreshWorker.close(),
  ])
  process.exit(0)
})
