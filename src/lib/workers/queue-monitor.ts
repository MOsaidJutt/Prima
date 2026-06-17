import type { Queue } from 'bullmq'
import { sendOnCallAlert } from '@/lib/alerts'
import { emailQueue, invoiceOverdueQueue, paymentReminderQueue } from '@/lib/queues'
import { performanceSnapshotQueue, matviewRefreshQueue } from '@/lib/queues'
import { inventoryPredictionQueue } from './inventory-prediction'
import { dormantClientQueue } from './dormant-client'
import { anomalyDetectionQueue } from './anomaly-detection'
import { platformInvoiceQueue } from './platform-invoicing'
import { subscriptionLifecycleQueue } from './subscription-lifecycle'

// Phase 7 monitoring: every BullMQ queue in the app, checked on a timer (see
// registerQueueMonitor below) so a stuck/backed-up worker pages on-call
// instead of silently delaying invoices, reminders, or AI jobs.
const MONITORED_QUEUES: Record<string, Queue> = {
  email: emailQueue,
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

const WAITING_THRESHOLD = 500
const FAILED_THRESHOLD = 10

export async function checkQueueDepths() {
  for (const [name, queue] of Object.entries(MONITORED_QUEUES)) {
    try {
      const counts = await queue.getJobCounts('waiting', 'active', 'failed', 'delayed')
      if ((counts.waiting ?? 0) > WAITING_THRESHOLD) {
        await sendOnCallAlert(
          `Queue "${name}" backlog`,
          `${counts.waiting} jobs waiting (threshold ${WAITING_THRESHOLD}). Active: ${counts.active}, delayed: ${counts.delayed}.`,
          'warning'
        )
      }
      if ((counts.failed ?? 0) > FAILED_THRESHOLD) {
        await sendOnCallAlert(
          `Queue "${name}" has failed jobs`,
          `${counts.failed} failed jobs (threshold ${FAILED_THRESHOLD}). Inspect via Redis / a BullMQ dashboard (Bull Board, Taskforce.sh).`,
          'critical'
        )
      }
    } catch (err) {
      console.error(`[queue-monitor] failed to check queue "${name}"`, err)
    }
  }
}

/** Starts a `setInterval` that runs checkQueueDepths every `intervalMs` (default 15 min). */
export function registerQueueMonitor(intervalMs = 15 * 60 * 1000): NodeJS.Timeout {
  return setInterval(() => {
    checkQueueDepths().catch((err) => console.error('[queue-monitor] check failed', err))
  }, intervalMs)
}
