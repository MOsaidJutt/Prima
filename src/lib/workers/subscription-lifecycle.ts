import { Worker, Queue } from 'bullmq'
import { redisConnection } from '@/lib/redis'
import { runSubscriptionLifecycle } from '@/lib/jobs/subscription-lifecycle'

export const subscriptionLifecycleQueue = new Queue('subscription-lifecycle', {
  connection: redisConnection,
})

export function startSubscriptionLifecycleWorker() {
  return new Worker('subscription-lifecycle', async () => runSubscriptionLifecycle(), {
    connection: redisConnection,
    concurrency: 1,
  })
}
