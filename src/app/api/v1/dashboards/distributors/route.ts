import { NextResponse } from 'next/server'
import { withTenantApi } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'
import { cacheGet, cacheSet, dashboardKey } from '@/lib/dashboard-cache'
import { startOfMonth, endOfDay } from 'date-fns'

export async function GET(req: Request) {
  return withTenantApi(req, 'dashboard:read', async ({ ctx }) => {
    const orgId = ctx.organizationId
    const url = new URL(req.url)
    const from = url.searchParams.get('from')
      ? new Date(url.searchParams.get('from')!)
      : startOfMonth(new Date())
    const to = url.searchParams.get('to')
      ? new Date(url.searchParams.get('to')!)
      : endOfDay(new Date())

    const cacheKey = dashboardKey(
      orgId,
      'distributors',
      `${from.toISOString().slice(0, 10)}_${to.toISOString().slice(0, 10)}`
    )
    const cached = await cacheGet(cacheKey)
    if (cached)
      return new Response(JSON.stringify(cached), {
        headers: { 'Content-Type': 'application/json' },
      }) as never

    const [total, active, inactive, blacklisted, tierDist, topDistributors, mapPoints] =
      await Promise.all([
        prisma.distributor.count({ where: { organizationId: orgId, deletedAt: null } }),
        prisma.distributor.count({
          where: { organizationId: orgId, status: 'ACTIVE', deletedAt: null },
        }),
        prisma.distributor.count({
          where: { organizationId: orgId, status: 'INACTIVE', deletedAt: null },
        }),
        prisma.distributor.count({
          where: { organizationId: orgId, status: 'BLACKLISTED', deletedAt: null },
        }),
        prisma.distributor.groupBy({
          by: ['tier'],
          where: { organizationId: orgId, deletedAt: null },
          _count: true,
        }),
        prisma.distributor.findMany({
          where: { organizationId: orgId, deletedAt: null },
          orderBy: { totalPurchases: 'desc' },
          take: 10,
          select: {
            id: true,
            code: true,
            companyName: true,
            city: true,
            status: true,
            tier: true,
            totalPurchases: true,
            currentBalance: true,
            rating: true,
          },
        }),
        prisma.distributor.findMany({
          where: {
            organizationId: orgId,
            deletedAt: null,
            latitude: { not: null },
            longitude: { not: null },
          },
          select: { id: true, companyName: true, city: true, latitude: true, longitude: true },
          take: 200,
        }),
      ])

    const data = {
      kpis: { total, active, inactive, blacklisted },
      tierDist: tierDist.map((t) => ({ name: t.tier, value: t._count })),
      topDistributors: topDistributors.map((d) => ({
        id: d.id,
        code: d.code,
        name: d.companyName,
        city: d.city,
        status: d.status,
        tier: d.tier,
        totalPurchases: Number(d.totalPurchases),
        balance: Number(d.currentBalance),
        rating: Number(d.rating),
      })),
      mapPoints: mapPoints.map((d) => ({
        lat: Number(d.latitude),
        lng: Number(d.longitude),
        label: d.companyName,
        value: d.city ?? '',
      })),
    }

    await cacheSet(cacheKey, data)
    return new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json' },
    }) as never
  })
}
