import { withTenantApi } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'
import { cacheGet, cacheSet, dashboardKey } from '@/lib/dashboard-cache'
import { startOfMonth, endOfDay } from 'date-fns'

export async function GET(req: Request) {
  return withTenantApi(req, 'dashboard:read', async ({ ctx, user }) => {
    const orgId = ctx.organizationId
    const managerId = user.id
    const url = new URL(req.url)
    const from = url.searchParams.get('from')
      ? new Date(url.searchParams.get('from')!)
      : startOfMonth(new Date())
    const to = url.searchParams.get('to')
      ? new Date(url.searchParams.get('to')!)
      : endOfDay(new Date())

    const cacheKey = dashboardKey(
      orgId,
      `manager_${managerId}`,
      `${from.toISOString().slice(0, 10)}_${to.toISOString().slice(0, 10)}`
    )
    const cached = await cacheGet(cacheKey)
    if (cached)
      return new Response(JSON.stringify(cached), {
        headers: { 'Content-Type': 'application/json' },
      }) as never

    // Get manager's department
    const manager = await prisma.user.findUnique({
      where: { id: managerId },
      select: { departmentId: true },
    })

    // Team = users in same department (excluding manager)
    const teamUsers = await prisma.user.findMany({
      where: {
        organizationId: orgId,
        departmentId: manager?.departmentId ?? undefined,
        isActive: true,
        deletedAt: null,
        id: { not: managerId },
      },
      select: { id: true, name: true, avatar: true },
    })
    const teamIds = teamUsers.map((u) => u.id)

    const [pendingDSRs, teamRevenue, pendingQueue, teamDSRCounts] = await Promise.all([
      prisma.dSREntry.count({
        where: {
          organizationId: orgId,
          status: 'SUBMITTED',
          submittedById: { in: teamIds },
          deletedAt: null,
        },
      }),
      prisma.invoice.aggregate({
        where: {
          organizationId: orgId,
          createdById: { in: teamIds },
          issueDate: { gte: from, lte: to },
          deletedAt: null,
        },
        _sum: { grandTotal: true },
      }),
      prisma.dSREntry.findMany({
        where: {
          organizationId: orgId,
          status: 'SUBMITTED',
          submittedById: { in: teamIds },
          deletedAt: null,
        },
        orderBy: { createdAt: 'asc' },
        take: 15,
        select: {
          id: true,
          status: true,
          grandTotal: true,
          reportDate: true,
          createdAt: true,
          submittedBy: { select: { id: true, name: true } },
          client: { select: { id: true, companyName: true } },
        },
      }),
      prisma.dSREntry.groupBy({
        by: ['submittedById'],
        where: {
          organizationId: orgId,
          submittedById: { in: teamIds },
          reportDate: { gte: from, lte: to },
          deletedAt: null,
        },
        _count: true,
        _sum: { grandTotal: true },
      }),
    ])

    const teamPerformance = teamUsers
      .map((u, i) => {
        const stats = teamDSRCounts.find((d) => d.submittedById === u.id)
        return {
          rank: i + 1,
          id: u.id,
          name: u.name,
          avatar: u.avatar,
          dsrs: stats?._count ?? 0,
          value: Number(stats?._sum.grandTotal ?? 0),
        }
      })
      .sort((a, b) => b.value - a.value)
      .map((p, i) => ({ ...p, rank: i + 1 }))

    const data = {
      kpis: {
        teamSize: teamUsers.length,
        pendingDSRs,
        teamRevenue: Number(teamRevenue._sum.grandTotal ?? 0),
        approvalRate: 0,
      },
      pendingQueue: pendingQueue.map((d) => ({ ...d, grandTotal: Number(d.grandTotal) })),
      teamPerformance,
    }

    await cacheSet(cacheKey, data, 60) // 1 min cache for manager (pending queue changes often)
    return new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json' },
    }) as never
  })
}
