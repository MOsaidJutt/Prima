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
    const deptId = url.searchParams.get('dept') || undefined

    const cacheKey = dashboardKey(
      orgId,
      'epr',
      `${from.toISOString().slice(0, 10)}_${to.toISOString().slice(0, 10)}_${deptId ?? ''}`
    )
    const cached = await cacheGet(cacheKey)
    if (cached)
      return new Response(JSON.stringify(cached), {
        headers: { 'Content-Type': 'application/json' },
      }) as never

    const userWhere = {
      organizationId: orgId,
      isActive: true,
      deletedAt: null,
      ...(deptId ? { departmentId: deptId } : {}),
    }

    const users = await prisma.user.findMany({
      where: userWhere,
      select: {
        id: true,
        name: true,
        avatar: true,
        departmentId: true,
        department: { select: { name: true } },
      },
    })

    const userIds = users.map((u) => u.id)

    // For each user: DSR count, revenue, approval rate
    const [dsrCounts, revenues] = await Promise.all([
      prisma.dSREntry.groupBy({
        by: ['submittedById', 'status'],
        where: {
          organizationId: orgId,
          reportDate: { gte: from, lte: to },
          submittedById: { in: userIds },
          deletedAt: null,
        },
        _count: true,
      }),
      prisma.invoice.groupBy({
        by: ['createdById'],
        where: {
          organizationId: orgId,
          issueDate: { gte: from, lte: to },
          createdById: { in: userIds },
          deletedAt: null,
        },
        _sum: { grandTotal: true },
      }),
    ])

    const performance = users.map((user, idx) => {
      const userDSRs = dsrCounts.filter((d) => d.submittedById === user.id)
      const total = userDSRs.reduce((s, d) => s + d._count, 0)
      const approved = userDSRs.find((d) => d.status === 'APPROVED')?._count ?? 0
      const revenue = revenues.find((r) => r.createdById === user.id)
      return {
        rank: idx + 1,
        id: user.id,
        name: user.name,
        avatar: user.avatar,
        department: user.department?.name ?? '—',
        dsrCount: total,
        approvedDSRs: approved,
        approvalRate: total > 0 ? (approved / total) * 100 : 0,
        revenue: Number(revenue?._sum.grandTotal ?? 0),
        value: Number(revenue?._sum.grandTotal ?? 0),
      }
    })

    performance.sort((a, b) => b.revenue - a.revenue)
    performance.forEach((p, i) => {
      p.rank = i + 1
    })

    const activeReps = performance.length
    const avgDSR = activeReps > 0 ? performance.reduce((s, p) => s + p.dsrCount, 0) / activeReps : 0
    const avgRevenue =
      activeReps > 0 ? performance.reduce((s, p) => s + p.revenue, 0) / activeReps : 0

    const data = {
      kpis: { activeReps, avgDSR: Math.round(avgDSR), avgRevenue: Math.round(avgRevenue) },
      performance,
    }

    await cacheSet(cacheKey, data)
    return new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json' },
    }) as never
  })
}
