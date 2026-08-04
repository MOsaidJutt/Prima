import { Worker, Queue } from 'bullmq'
import { redisConnection } from '@/lib/redis'
import { runDormantClientDetection, runDormantClientDetectionAll } from '@/lib/jobs/dormant-client'

export const dormantClientQueue = new Queue('dormant-client', { connection: redisConnection })

export function startDormantClientWorker() {
  return new Worker(
    'dormant-client',
    async (job) => {
      const { orgId } = job.data as { orgId?: string }
      if (orgId) {
        try {
          await runDormantClientDetection(orgId)
        } catch (err) {
          console.error(`[dormant-client] org ${orgId} failed:`, err)
          throw err
        }
      } else {
        await runDormantClientDetectionAll()
      }
    },
    { connection: redisConnection, concurrency: 1 }
  )
}
