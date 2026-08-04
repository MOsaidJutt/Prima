/**
 * BullMQ worker bootstrap.
 * Import this file once in a long-running Node.js process (e.g. a custom server
 * or a dedicated worker entry point).  Do NOT import this file in Next.js
 * edge/serverless routes — workers need a persistent process.
 *
 * Local dev: `tsx src/lib/workers/index.ts`
 * Production: run via a separate Fly.io / Railway / Render worker process
 *             pointing at the same REDIS_URL.
 *
 * On a serverless host with no persistent process, the same jobs run over HTTP
 * instead — see src/app/api/cron/[job]/route.ts and docs/DEPLOYMENT.md. Both
 * paths execute the identical functions from src/lib/jobs and share the cron
 * expressions defined there.
 */

import type { Queue } from 'bullmq'
import {
  invoiceOverdueQueue,
  paymentReminderQueue,
  performanceSnapshotQueue,
  matviewRefreshQueue,
} from '@/lib/queues'
import { JOBS, type JobName } from '@/lib/jobs'
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

/** The queue each scheduled job is dispatched on. */
const JOB_QUEUES: Record<JobName, Queue> = {
  'invoice-overdue': invoiceOverdueQueue,
  'payment-reminder': paymentReminderQueue,
  'performance-snapshot': performanceSnapshotQueue,
  'matview-refresh': matviewRefreshQueue,
  'inventory-prediction': inventoryPredictionQueue,
  'dormant-client': dormantClientQueue,
  'anomaly-detection': anomalyDetectionQueue,
  'platform-invoicing': platformInvoiceQueue,
  'subscription-lifecycle': subscriptionLifecycleQueue,
}

// Register recurring cron jobs from the shared schedule in @/lib/jobs, so the
// worker and the HTTP cron route can never drift apart.
async function registerCrons() {
  for (const [name, job] of Object.entries(JOBS)) {
    const queue = JOB_QUEUES[name as JobName]
    await queue.add(
      name,
      {},
      {
        repeat: { pattern: job.schedule },
        jobId: `${name}-cron`,
        removeOnComplete: true,
      }
    )
  }

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
