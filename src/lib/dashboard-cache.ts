import IORedis from 'ioredis'

const url = process.env.REDIS_URL ?? 'redis://localhost:6379'

// Separate client for caching — lower connection priority than BullMQ
let _cache: IORedis | null = null
function getCache(): IORedis {
  if (!_cache) {
    _cache = new IORedis(url, {
      maxRetriesPerRequest: 1,
      enableReadyCheck: false,
      lazyConnect: true,
    })
    _cache.on('error', () => {})
  }
  return _cache
}

const TTL = 300 // 5 minutes

export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const raw = await getCache().get(key)
    if (!raw) return null
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export async function cacheSet<T>(key: string, value: T, ttl = TTL): Promise<void> {
  try {
    await getCache().setex(key, ttl, JSON.stringify(value))
  } catch {
    // cache miss is acceptable; queries still work
  }
}

export async function cacheDel(key: string): Promise<void> {
  try {
    await getCache().del(key)
  } catch {}
}

export function dashboardKey(orgId: string, dashboard: string, filters = ''): string {
  return `dash:${orgId}:${dashboard}${filters ? `:${filters}` : ''}`
}
