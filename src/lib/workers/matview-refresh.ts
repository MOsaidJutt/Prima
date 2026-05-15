import { Worker } from 'bullmq'
import { redisConnection } from '@/lib/redis'
import { prisma } from '@/lib/prisma'

export const matviewRefreshWorker = new Worker(
  'matview-refresh',
  async () => {
    // Refresh both materialized views in sequence
    await prisma.$executeRawUnsafe('REFRESH MATERIALIZED VIEW CONCURRENTLY "mv_daily_revenue"')
    await prisma.$executeRawUnsafe('REFRESH MATERIALIZED VIEW CONCURRENTLY "mv_monthly_user_perf"')
    console.log('[matview-refresh] Views refreshed at', new Date().toISOString())
  },
  {
    connection: redisConnection,
    concurrency: 1,
  }
)

matviewRefreshWorker.on('failed', (job, err) => {
  console.error('[matview-refresh] Job failed:', err)
})
