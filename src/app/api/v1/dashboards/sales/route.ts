import { withTenantApi } from '@/lib/api-helpers'
import { prisma, Prisma } from '@/lib/prisma'
import { cacheGet, cacheSet, dashboardKey } from '@/lib/dashboard-cache'
import { format, startOfMonth, endOfDay } from 'date-fns'

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
    const userId = url.searchParams.get('user') || undefined

    const filterSuffix = `${from.toISOString().slice(0, 10)}_${to.toISOString().slice(0, 10)}_${deptId ?? ''}_${userId ?? ''}`
    const cacheKey = dashboardKey(orgId, 'sales', filterSuffix)
    const cached = await cacheGet(cacheKey)
    if (cached)
      return new Response(JSON.stringify(cached), {
        headers: { 'Content-Type': 'application/json' },
      }) as never

    const whereInvoice = {
      organizationId: orgId,
      issueDate: { gte: from, lte: to },
      deletedAt: null,
      ...(userId ? { createdById: userId } : {}),
    }

    const whereDSR = {
      organizationId: orgId,
      reportDate: { gte: from, lte: to },
      deletedAt: null,
      ...(userId ? { submittedById: userId } : {}),
      ...(deptId ? { submittedBy: { departmentId: deptId } } : {}),
    }

    const [
      totalRevenue,
      totalDSRs,
      approvedDSRs,
      newClients,
      totalUnits,
      visitTypeDist,
      revenueByRep,
      dailyRevenue,
      topClients,
    ] = await Promise.all([
      prisma.invoice.aggregate({ where: whereInvoice, _sum: { grandTotal: true } }),
      prisma.dSREntry.count({ where: whereDSR }),
      prisma.dSREntry.count({ where: { ...whereDSR, status: 'APPROVED' } }),
      prisma.client.count({
        where: { organizationId: orgId, createdAt: { gte: from, lte: to }, deletedAt: null },
      }),
      prisma.dSRLineItem.aggregate({
        where: { dsrEntry: { ...whereDSR } },
        _sum: { quantity: true },
      }),
      prisma.dSREntry.groupBy({
        by: ['visitType'],
        where: whereDSR,
        _count: true,
      }),
      prisma.invoice.groupBy({
        by: ['createdById'],
        where: { ...whereInvoice, createdById: { not: null } },
        _sum: { grandTotal: true },
        orderBy: { _sum: { grandTotal: 'desc' } },
        take: 8,
      }),
      // H-2: single GROUP BY DATE query replacing 30 sequential aggregates
      prisma.$queryRaw<{ date: Date; revenue: string }[]>(
        userId
          ? Prisma.sql`
              SELECT DATE("issueDate") AS date, SUM("grandTotal")::text AS revenue
              FROM "Invoice"
              WHERE "organizationId" = ${orgId}::uuid
                AND "issueDate" >= ${from} AND "issueDate" <= ${to}
                AND "deletedAt" IS NULL
                AND "createdById" = ${userId}::uuid
              GROUP BY DATE("issueDate")
              ORDER BY DATE("issueDate")`
          : Prisma.sql`
              SELECT DATE("issueDate") AS date, SUM("grandTotal")::text AS revenue
              FROM "Invoice"
              WHERE "organizationId" = ${orgId}::uuid
                AND "issueDate" >= ${from} AND "issueDate" <= ${to}
                AND "deletedAt" IS NULL
              GROUP BY DATE("issueDate")
              ORDER BY DATE("issueDate")`
      ),
      prisma.invoice.groupBy({
        by: ['clientId'],
        where: whereInvoice,
        _sum: { grandTotal: true },
        orderBy: { _sum: { grandTotal: 'desc' } },
        take: 5,
      }),
    ])

    // Enrich rep names
    const repIds = revenueByRep.map((r) => r.createdById!).filter(Boolean)
    const repUsers = repIds.length
      ? await prisma.user.findMany({
          where: { id: { in: repIds } },
          select: { id: true, name: true, avatar: true },
        })
      : []

    // Enrich client names
    const clientIds = topClients.map((c) => c.clientId)
    const clientRecords = clientIds.length
      ? await prisma.client.findMany({
          where: { id: { in: clientIds } },
          select: { id: true, companyName: true },
        })
      : []

    // Build a full 30-day series filling zeros for days with no invoices
    const dailyRevenueRows = dailyRevenue as { date: Date; revenue: string }[]
    const revenueByDate = Object.fromEntries(
      dailyRevenueRows.map((r) => [format(new Date(r.date), 'dd MMM'), Number(r.revenue)])
    )
    const fullDailyRevenue = Array.from({ length: 30 }).map((_, i) => {
      const d = new Date(to)
      d.setDate(d.getDate() - (29 - i))
      const label = format(d, 'dd MMM')
      return { name: label, revenue: revenueByDate[label] ?? 0 }
    })

    const data = {
      kpis: {
        totalRevenue: Number(totalRevenue._sum.grandTotal ?? 0),
        totalDSRs,
        approvedDSRs,
        conversionRate: totalDSRs > 0 ? (approvedDSRs / totalDSRs) * 100 : 0,
        newClients,
        totalUnits: totalUnits._sum.quantity ?? 0,
      },
      dailyRevenue: fullDailyRevenue,
      visitTypeDist: visitTypeDist.map((v) => ({ name: v.visitType, value: v._count })),
      revenueByRep: revenueByRep.map((r, i) => {
        const u = repUsers.find((u) => u.id === r.createdById)
        return {
          rank: i + 1,
          id: r.createdById ?? '',
          name: u?.name ?? 'Unknown',
          avatar: u?.avatar,
          value: Number(r._sum.grandTotal ?? 0),
        }
      }),
      topClients: topClients.map((c) => {
        const cl = clientRecords.find((r) => r.id === c.clientId)
        return {
          id: c.clientId,
          name: cl?.companyName ?? 'Unknown',
          value: Number(c._sum.grandTotal ?? 0),
        }
      }),
    }

    await cacheSet(cacheKey, data)
    return new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json' },
    }) as never
  })
}
