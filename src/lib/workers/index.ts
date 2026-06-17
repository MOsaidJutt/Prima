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
import { startInventoryPredictionWorker, inventoryPredictionQueue } from './inventory-prediction'
import { startDormantClientWorker, dormantClientQueue } from './dormant-client'
import { startAnomalyDetectionWorker, anomalyDetectionQueue } from './anomaly-detection'
import { startPlatformInvoiceWorker, platformInvoiceQueue } from './platform-invoicing'
import {
  startSubscriptionLifecycleWorker,
  subscriptionLifecycleQueue,
} from './subscription-lifecycle'
import { registerQueueMonitor } from './queue-monitor'

// Start all workers
const overdueWorker = startInvoiceOverdueWorker()
const reminderWorker = startPaymentReminderWorker()
const snapshotWorker = startPerformanceSnapshotWorker()
const inventoryPredictionWorker = startInventoryPredictionWorker()
const dormantClientWorker = startDormantClientWorker()
const anomalyDetectionWorker = startAnomalyDetectionWorker()
const platformInvoiceWorker = startPlatformInvoiceWorker()
const subscriptionLifecycleWorker = startSubscriptionLifecycleWorker()
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

  // Inventory demand predictions — every night at 03:00 UTC
  await inventoryPredictionQueue.add(
    'run-predictions',
    {},
    {
      repeat: { pattern: '0 3 * * *' },
      jobId: 'inventory-prediction-cron',
      removeOnComplete: true,
    }
  )

  // Dormant client detection — every day at 04:00 UTC
  await dormantClientQueue.add(
    'detect-dormant',
    {},
    {
      repeat: { pattern: '0 4 * * *' },
      jobId: 'dormant-client-cron',
      removeOnComplete: true,
    }
  )

  // Anomaly detection — every 6 hours
  await anomalyDetectionQueue.add(
    'detect-anomalies',
    {},
    {
      repeat: { pattern: '0 */6 * * *' },
      jobId: 'anomaly-detection-cron',
      removeOnComplete: true,
    }
  )

  // Platform invoicing — 1st of each month at 05:00 UTC
  await platformInvoiceQueue.add(
    'generate-invoices',
    {},
    {
      repeat: { pattern: '0 5 1 * *' },
      jobId: 'platform-invoicing-cron',
      removeOnComplete: true,
    }
  )

  // Subscription lifecycle (trial reminders, renewals, past-due/suspension escalation) — daily at 06:00 UTC
  await subscriptionLifecycleQueue.add(
    'run-lifecycle',
    {},
    {
      repeat: { pattern: '0 6 * * *' },
      jobId: 'subscription-lifecycle-cron',
      removeOnComplete: true,
    }
  )

  console.log('[workers] Cron jobs registered')
}

registerCrons().catch(console.error)

// Phase 7: alert on-call (email + optional Twilio WhatsApp) when any queue
// backs up or accumulates failed jobs — see src/lib/workers/queue-monitor.ts
const queueMonitorTimer = registerQueueMonitor()

console.log('[workers] All workers started')

// Graceful shutdown
process.on('SIGTERM', async () => {
  clearInterval(queueMonitorTimer)
  await Promise.all([
    overdueWorker.close(),
    reminderWorker.close(),
    snapshotWorker.close(),
    matviewRefreshWorker.close(),
    inventoryPredictionWorker.close(),
    dormantClientWorker.close(),
    anomalyDetectionWorker.close(),
    platformInvoiceWorker.close(),
    subscriptionLifecycleWorker.close(),
  ])
  process.exit(0)
})
