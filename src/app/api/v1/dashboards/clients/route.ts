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
      'clients',
      `${from.toISOString().slice(0, 10)}_${to.toISOString().slice(0, 10)}`
    )
    const cached = await cacheGet(cacheKey)
    if (cached)
      return new Response(JSON.stringify(cached), {
        headers: { 'Content-Type': 'application/json' },
      }) as never

    const [
      total,
      active,
      inactive,
      prospect,
      churned,
      businessTypeDist,
      topByLTV,
      mapPoints,
      businessSizeDist,
    ] = await Promise.all([
      prisma.client.count({ where: { organizationId: orgId, deletedAt: null } }),
      prisma.client.count({ where: { organizationId: orgId, status: 'ACTIVE', deletedAt: null } }),
      prisma.client.count({
        where: { organizationId: orgId, status: 'INACTIVE', deletedAt: null },
      }),
      prisma.client.count({
        where: { organizationId: orgId, status: 'PROSPECT', deletedAt: null },
      }),
      prisma.client.count({ where: { organizationId: orgId, status: 'CHURNED', deletedAt: null } }),
      prisma.client.groupBy({
        by: ['businessType'],
        where: { organizationId: orgId, deletedAt: null, businessType: { not: null } },
        _count: true,
      }),
      prisma.client.findMany({
        where: { organizationId: orgId, deletedAt: null },
        orderBy: { totalLifetimeValue: 'desc' },
        take: 10,
        select: {
          id: true,
          code: true,
          companyName: true,
          status: true,
          totalLifetimeValue: true,
          totalOrders: true,
          lastOrderDate: true,
          paymentBehaviorScore: true,
          paymentBehaviorLabel: true,
        },
      }),
      prisma.client.findMany({
        where: {
          organizationId: orgId,
          deletedAt: null,
          latitude: { not: null },
          longitude: { not: null },
        },
        select: { id: true, companyName: true, city: true, latitude: true, longitude: true },
        take: 200,
      }),
      prisma.client.groupBy({
        by: ['businessSize'],
        where: { organizationId: orgId, deletedAt: null, businessSize: { not: null } },
        _count: true,
      }),
    ])

    const newClientsThisPeriod = await prisma.client.count({
      where: { organizationId: orgId, createdAt: { gte: from, lte: to }, deletedAt: null },
    })

    const data = {
      kpis: { total, active, inactive, prospect, churned, newThisPeriod: newClientsThisPeriod },
      businessTypeDist: businessTypeDist.map((b) => ({
        name: b.businessType ?? 'Other',
        value: b._count,
      })),
      businessSizeDist: businessSizeDist.map((b) => ({
        name: b.businessSize ?? 'Unknown',
        value: b._count,
      })),
      topByLTV: topByLTV.map((c) => ({
        id: c.id,
        code: c.code,
        name: c.companyName,
        status: c.status,
        ltv: Number(c.totalLifetimeValue),
        orders: c.totalOrders,
        lastOrder: c.lastOrderDate,
        score: c.paymentBehaviorScore,
        scoreLabel: c.paymentBehaviorLabel,
      })),
      mapPoints: mapPoints.map((c) => ({
        lat: Number(c.latitude),
        lng: Number(c.longitude),
        label: c.companyName,
        value: c.city ?? '',
      })),
    }

    await cacheSet(cacheKey, data)
    return new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json' },
    }) as never
  })
}
