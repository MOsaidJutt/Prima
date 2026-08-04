import { Worker, Queue } from 'bullmq'
import { redisConnection } from '@/lib/redis'
import { runAnomalyDetection, runAnomalyDetectionAll } from '@/lib/jobs/anomaly-detection'

export const anomalyDetectionQueue = new Queue('anomaly-detection', {
  connection: redisConnection,
})

export function startAnomalyDetectionWorker() {
  return new Worker(
    'anomaly-detection',
    async (job) => {
      const { orgId } = job.data as { orgId?: string }
      if (orgId) {
        try {
          await runAnomalyDetection(orgId)
        } catch (err) {
          console.error(`[anomaly-detection] org ${orgId} failed:`, err)
          throw err
        }
      } else {
        await runAnomalyDetectionAll()
      }
    },
    { connection: redisConnection, concurrency: 1 }
  )
}
