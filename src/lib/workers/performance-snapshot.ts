import { Worker } from 'bullmq'
import { redisConnection } from '@/lib/redis'
import { runPerformanceSnapshots } from '@/lib/jobs/performance-snapshot'

// Runs nightly; generates PerformanceSnapshot for every active sales rep.
export function startPerformanceSnapshotWorker() {
  return new Worker('performance-snapshot', async () => runPerformanceSnapshots(), {
    connection: redisConnection,
    concurrency: 1,
  })
}
