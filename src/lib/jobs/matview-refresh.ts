import { prisma } from '@/lib/prisma'

/** Refreshes both dashboard materialized views in sequence. */
export async function runMatviewRefresh(): Promise<void> {
  await prisma.$executeRawUnsafe('REFRESH MATERIALIZED VIEW CONCURRENTLY "mv_daily_revenue"')
  await prisma.$executeRawUnsafe('REFRESH MATERIALIZED VIEW CONCURRENTLY "mv_monthly_user_perf"')
  console.log('[matview-refresh] Views refreshed at', new Date().toISOString())
}
