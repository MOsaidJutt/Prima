import { NextResponse } from 'next/server'
import { withTenantApi } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'
import { cacheGet, cacheSet, dashboardKey } from '@/lib/dashboard-cache'
import { subMonths, startOfMonth, format, startOfDay, endOfDay } from 'date-fns'

export async function GET(req: Request, { params }: { params: Promise<{ userId: string }> }) {
  return withTenantApi(req, 'dashboard:read', async ({ ctx }) => {
    const { userId } = await params
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
      `epr_${userId}`,
      `${from.toISOString().slice(0, 10)}_${to.toISOString().slice(0, 10)}`
    )
    const cached = await cacheGet(cacheKey)
    if (cached)
      return new Response(JSON.stringify(cached), {
        headers: { 'Content-Type': 'application/json' },
      }) as never

    const user = await prisma.user.findFirst({
      where: { id: userId, organizationId: orgId, deletedAt: null },
      select: {
        id: true,
        name: true,
        avatar: true,
        department: { select: { name: true } },
        role: { select: { name: true } },
      },
    })
    if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const [dsrStats, revenueAgg, targets, recentDSRs, monthlyPerf] = await Promise.all([
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
        take: 10,
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
          const [dsrCount, revAgg] = await Promise.all([
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
          return {
            name: format(d, 'MMM yy'),
            dsrs: dsrCount,
            revenue: Number(revAgg._sum.grandTotal ?? 0),
          }
        })
      ),
    ])

    const totalDSRs = dsrStats.reduce((s, d) => s + d._count, 0)
    const approved = dsrStats.find((d) => d.status === 'APPROVED')?._count ?? 0

    const data = {
      user: {
        id: user.id,
        name: user.name,
        avatar: user.avatar,
        department: user.department?.name,
        role: user.role.name,
      },
      kpis: {
        totalDSRs,
        approvedDSRs: approved,
        approvalRate: totalDSRs > 0 ? (approved / totalDSRs) * 100 : 0,
        revenue: Number(revenueAgg._sum.grandTotal ?? 0),
        collected: Number(revenueAgg._sum.paidAmount ?? 0),
      },
      targets: targets.map((t) => ({
        name: t.name,
        target: Number(t.targetValue),
        achieved: Number(t.achievedValue),
        type: t.type,
      })),
      recentDSRs: recentDSRs.map((d) => ({ ...d, grandTotal: Number(d.grandTotal) })),
      monthlyPerf,
    }

    await cacheSet(cacheKey, data)
    return new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json' },
    }) as never
  })
}
