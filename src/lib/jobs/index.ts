import { runInvoiceOverdue } from './invoice-overdue'
import { runPaymentReminderSweep } from './payment-reminder'
import { runPerformanceSnapshots } from './performance-snapshot'
import { runMatviewRefresh } from './matview-refresh'
import { runInventoryPredictions } from './inventory-prediction'
import { runDormantClientDetectionAll } from './dormant-client'
import { runAnomalyDetectionAll } from './anomaly-detection'
import { runPlatformInvoicing } from './platform-invoicing'
import { runSubscriptionLifecycle } from './subscription-lifecycle'

/**
 * Every scheduled job, addressable by name.
 *
 * These functions import no BullMQ or Redis code, so they run either from the
 * persistent worker process (src/lib/workers/index.ts) or from the HTTP cron
 * route (src/app/api/cron/[job]/route.ts) on a serverless host. `schedule` is
 * the UTC cron expression both paths use — see docs/DEPLOYMENT.md.
 */
export const JOBS = {
  'invoice-overdue': {
    run: runInvoiceOverdue,
    schedule: '0 1 * * *',
    description: 'Mark issued invoices overdue once past their due date',
  },
  'payment-reminder': {
    run: runPaymentReminderSweep,
    schedule: '0 7 * * *',
    description: 'Send client payment reminders at -3/0/+7/+14/+30 days around due date',
  },
  'performance-snapshot': {
    run: runPerformanceSnapshots,
    schedule: '30 0 * * *',
    description: "Build yesterday's per-rep performance snapshots",
  },
  'matview-refresh': {
    run: runMatviewRefresh,
    schedule: '0 2 * * *',
    description: 'Refresh dashboard materialized views',
  },
  'inventory-prediction': {
    run: runInventoryPredictions,
    schedule: '0 3 * * *',
    description: 'Regenerate demand forecasts for AI-enabled orgs',
  },
  'dormant-client': {
    run: runDormantClientDetectionAll,
    schedule: '0 4 * * *',
    description: 'Flag high-value clients who have stopped ordering',
  },
  'anomaly-detection': {
    run: runAnomalyDetectionAll,
    schedule: '0 */6 * * *',
    description: 'Detect revenue drops, skipped DSRs, velocity shifts, order spikes',
  },
  'platform-invoicing': {
    run: runPlatformInvoicing,
    schedule: '0 5 1 * *',
    description: 'Generate and email monthly platform invoices',
  },
  'subscription-lifecycle': {
    run: runSubscriptionLifecycle,
    schedule: '0 6 * * *',
    description: 'Charge renewals, send trial reminders, escalate past-due orgs',
  },
} as const satisfies Record<
  string,
  { run: () => Promise<void>; schedule: string; description: string }
>

export type JobName = keyof typeof JOBS

export function isJobName(value: string): value is JobName {
  return Object.prototype.hasOwnProperty.call(JOBS, value)
}
