import { NextResponse } from 'next/server'
import { getSuperAdminSession } from '@/lib/auth/session'
import { requireOwner } from '@/lib/auth/permissions'
import { getRevenueStats } from '@/lib/billing/revenue'
import { cacheGet, cacheSet } from '@/lib/dashboard-cache'

const CACHE_KEY = 'dash:platform:revenue'

export async function GET() {
  const session = await getSuperAdminSession()
  const denied = requireOwner(session)
  if (denied || !session)
    return denied ?? NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const cached = await cacheGet<Awaited<ReturnType<typeof getRevenueStats>>>(CACHE_KEY)
    if (cached) return NextResponse.json({ success: true, data: cached, cached: true })

    const stats = await getRevenueStats()
    await cacheSet(CACHE_KEY, stats)
    return NextResponse.json({ success: true, data: stats })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
