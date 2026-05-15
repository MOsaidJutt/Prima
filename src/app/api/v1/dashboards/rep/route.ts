import { withTenantApi } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'
import { cacheGet, cacheSet, dashboardKey } from '@/lib/dashboard-cache'
import { subMonths, startOfMonth, format, endOfDay } from 'date-fns'

export async function GET(req: Request) {
  return withTenantApi(req, 'dashboard:read', async ({ ctx, user }) => {
    const orgId = ctx.organizationId
    const userId = user.id
    const url = new URL(req.url)
    const from = url.searchParams.get('from')
      ? new Date(url.searchParams.get('from')!)
      : startOfMonth(new Date())
    const to = url.searchParams.get('to')
      ? new Date(url.searchParams.get('to')!)
      : endOfDay(new Date())

    const cacheKey = dashboardKey(
      orgId,
      `rep_${userId}`,
      `${from.toISOString().slice(0, 10)}_${to.toISOString().slice(0, 10)}`
    )
    const cached = await cacheGet(cacheKey)
    if (cached)
      return new Response(JSON.stringify(cached), {
        headers: { 'Content-Type': 'application/json' },
      }) as never

    const [
      dsrStats,
      revenueAgg,
      pendingInvoices,
      targets,
      recentDSRs,
      monthlyPerf,
      clientsVisited,
    ] = await Promise.all([
      prisma.dSREntry.groupBy({
        by: ['status'],
        where: {
          organizationId: orgId,
          submittedById: userId,
          reportDate: { gte: from, lte: to },
          deletedAt: null,
        },
        _count: true,
      }),
      prisma.invoice.aggregate({
        where: {
          organizationId: orgId,
          createdById: userId,
          issueDate: { gte: from, lte: to },
          deletedAt: null,
        },
        _sum: { grandTotal: true, paidAmount: true },
      }),
      prisma.invoice.findMany({
        where: {
          organizationId: orgId,
          createdById: userId,
          status: { in: ['ISSUED', 'OVERDUE', 'PARTIALLY_PAID'] },
          deletedAt: null,
        },
        orderBy: { dueDate: 'asc' },
        take: 8,
        select: {
          id: true,
          invoiceNumber: true,
          status: true,
          grandTotal: true,
          paidAmount: true,
          dueDate: true,
          client: { select: { companyName: true } },
        },
      }),
      prisma.salesTarget.findMany({
        where: {
          organizationId: orgId,
          userId,
          isActive: true,
          deletedAt: null,
          periodStart: { lte: to },
          periodEnd: { gte: from },
        },
        select: { name: true, targetValue: true, achievedValue: true, type: true },
      }),
      prisma.dSREntry.findMany({
        where: { organizationId: orgId, submittedById: userId, deletedAt: null },
        orderBy: { reportDate: 'desc' },
        take: 8,
        select: {
          id: true,
          status: true,
          grandTotal: true,
          reportDate: true,
          client: { select: { companyName: true } },
        },
      }),
      Promise.all(
        Array.from({ length: 6 }).map(async (_, i) => {
          const now = new Date()
          const d = subMonths(now, 5 - i)
          const [cnt, agg] = await Promise.all([
            prisma.dSREntry.count({
              where: {
                organizationId: orgId,
                submittedById: userId,
                reportDate: { gte: startOfMonth(d) },
                deletedAt: null,
              },
            }),
            prisma.invoice.aggregate({
              where: {
                organizationId: orgId,
                createdById: userId,
                issueDate: { gte: startOfMonth(d) },
                deletedAt: null,
              },
              _sum: { grandTotal: true },
            }),
          ])
          return { name: format(d, 'MMM yy'), dsrs: cnt, revenue: Number(agg._sum.grandTotal ?? 0) }
        })
      ),
      prisma.dSREntry.groupBy({
        by: ['clientId'],
        where: {
          organizationId: orgId,
          submittedById: userId,
          reportDate: { gte: from, lte: to },
          deletedAt: null,
        },
        _count: true,
      }),
    ])

    const totalDSRs = dsrStats.reduce((s, d) => s + d._count, 0)
    const approved = dsrStats.find((d) => d.status === 'APPROVED')?._count ?? 0

    const data = {
      kpis: {
        totalDSRs,
        approvedDSRs: approved,
        approvalRate: totalDSRs > 0 ? (approved / totalDSRs) * 100 : 0,
        revenue: Number(revenueAgg._sum.grandTotal ?? 0),
        collected: Number(revenueAgg._sum.paidAmount ?? 0),
        clientsVisited: clientsVisited.length,
      },
      targets: targets.map((t) => ({
        name: t.name,
        target: Number(t.targetValue),
        achieved: Number(t.achievedValue),
        type: t.type,
      })),
      pendingInvoices: pendingInvoices.map((inv) => ({
        ...inv,
        grandTotal: Number(inv.grandTotal),
        paidAmount: Number(inv.paidAmount),
      })),
      recentDSRs: recentDSRs.map((d) => ({ ...d, grandTotal: Number(d.grandTotal) })),
      monthlyPerf,
    }

    await cacheSet(cacheKey, data, 60)
    return new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json' },
    }) as never
  })
}
