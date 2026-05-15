import IORedis from 'ioredis'

// Singleton redis connection for BullMQ
// Uses REDIS_URL if set (production); falls back to localhost for local dev.
const url = process.env.REDIS_URL ?? 'redis://localhost:6379'

export const redisConnection = new IORedis(url, {
  maxRetriesPerRequest: null, // required by BullMQ
  enableReadyCheck: false,
})
