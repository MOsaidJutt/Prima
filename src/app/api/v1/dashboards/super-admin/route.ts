import { NextResponse } from 'next/server'
import { getSuperAdminSession } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'
import { cacheGet, cacheSet } from '@/lib/dashboard-cache'
import { subMonths, startOfMonth, endOfMonth, format } from 'date-fns'

export async function GET() {
  const session = await getSuperAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const cacheKey = 'dash:sa:platform'
  const cached = await cacheGet(cacheKey)
  if (cached) return NextResponse.json(cached)

  const now = new Date()
  const thisMonthStart = startOfMonth(now)
  const lastMonthStart = startOfMonth(subMonths(now, 1))
  const lastMonthEnd = endOfMonth(subMonths(now, 1))

  const [
    totalOrgs,
    activeOrgs,
    trialOrgs,
    suspendedOrgs,
    cancelledOrgs,
    newThisMonth,
    newLastMonth,
    recentOrgs,
    planDist,
  ] = await Promise.all([
    prisma.organization.count({ where: { deletedAt: null } }),
    prisma.organization.count({ where: { status: 'ACTIVE', deletedAt: null } }),
    prisma.organization.count({ where: { status: 'TRIAL', deletedAt: null } }),
    prisma.organization.count({ where: { status: 'SUSPENDED', deletedAt: null } }),
    prisma.organization.count({ where: { status: 'CANCELLED', deletedAt: null } }),
    prisma.organization.count({ where: { createdAt: { gte: thisMonthStart }, deletedAt: null } }),
    prisma.organization.count({
      where: { createdAt: { gte: lastMonthStart, lte: lastMonthEnd }, deletedAt: null },
    }),
    prisma.organization.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        plan: true,
        createdAt: true,
        trialEndsAt: true,
      },
    }),
    prisma.organization.groupBy({
      by: ['plan'],
      where: { deletedAt: null },
      _count: true,
    }),
  ])

  // Monthly growth — last 6 months
  const monthlyGrowth = await Promise.all(
    Array.from({ length: 6 }).map(async (_, i) => {
      const d = subMonths(now, 5 - i)
      const count = await prisma.organization.count({
        where: {
          createdAt: { gte: startOfMonth(d), lte: endOfMonth(d) },
          deletedAt: null,
        },
      })
      return { name: format(d, 'MMM yy'), count }
    })
  )

  const data = {
    kpis: {
      totalOrgs,
      activeOrgs,
      trialOrgs,
      suspendedOrgs,
      cancelledOrgs,
      newThisMonth,
      signupTrend: newLastMonth > 0 ? ((newThisMonth - newLastMonth) / newLastMonth) * 100 : 0,
    },
    planDistribution: planDist.map((p) => ({ name: p.plan, value: p._count })),
    monthlyGrowth,
    recentOrgs,
  }

  await cacheSet(cacheKey, data)
  return NextResponse.json(data)
}
