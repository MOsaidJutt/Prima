import { Worker, Queue } from 'bullmq'
import { redisConnection } from '@/lib/redis'
import { runPredictionForOrg, runInventoryPredictions } from '@/lib/jobs/inventory-prediction'

export const inventoryPredictionQueue = new Queue('inventory-prediction', {
  connection: redisConnection,
})

export function startInventoryPredictionWorker() {
  return new Worker(
    'inventory-prediction',
    async (job) => {
      const { orgId } = job.data as { orgId?: string }

      if (orgId) {
        try {
          await runPredictionForOrg(orgId)
        } catch (err) {
          console.error(`[inventory-prediction] org ${orgId} failed:`, err)
          throw err // re-throw so BullMQ marks job as failed and retries
        }
      } else {
        await runInventoryPredictions()
      }
    },
    { connection: redisConnection, concurrency: 1 }
  )
}
