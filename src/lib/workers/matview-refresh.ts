import { Worker } from 'bullmq'
import { redisConnection } from '@/lib/redis'
import { runMatviewRefresh } from '@/lib/jobs/matview-refresh'

export const matviewRefreshWorker = new Worker('matview-refresh', async () => runMatviewRefresh(), {
  connection: redisConnection,
  concurrency: 1,
})

matviewRefreshWorker.on('failed', (job, err) => {
  console.error('[matview-refresh] Job failed:', err)
})
