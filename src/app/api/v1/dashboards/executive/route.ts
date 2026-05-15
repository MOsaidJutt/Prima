import { NextResponse } from 'next/server'
import { requireTenantAuth } from '@/lib/auth/require-tenant-auth'
import { prisma } from '@/lib/prisma'
import { cacheGet, cacheSet, dashboardKey } from '@/lib/dashboard-cache'
import { subMonths, startOfMonth, endOfMonth, format, startOfDay, endOfDay } from 'date-fns'

function parseFilters(req: Request) {
  const url = new URL(req.url)
  const from = url.searchParams.get('from')
  const to = url.searchParams.get('to')
  const now = new Date()
  return {
    from: from ? new Date(from) : startOfMonth(now),
    to: to ? new Date(to) : endOfDay(now),
  }
}

export async function GET(req: Request) {
  const auth = await requireTenantAuth('dashboard:read')
  if (!auth.ok) return auth.response

  const orgId = auth.session.organizationId
  const { from, to } = parseFilters(req)
  const filterSuffix = `${from.toISOString().slice(0, 10)}_${to.toISOString().slice(0, 10)}`
  const cacheKey = dashboardKey(orgId, 'executive', filterSuffix)

  const cached = await cacheGet(cacheKey)
  if (cached) return NextResponse.json(cached)

  const lastFrom = subMonths(from, 1)
  const lastTo = subMonths(to, 1)

  const [
    totalRevenue,
    lastMonthRevenue,
    activeClients,
    newClients,
    pendingDSRs,
    submittedDSRs,
    outstandingInvoices,
    collectedThisMonth,
    teamSize,
    topReps,
    recentDSRs,
    invoiceStatusDist,
    targets,
  ] = await Promise.all([
    // Revenue this period (from paid invoices)
    prisma.invoice.aggregate({
      where: {
        organizationId: orgId,
        status: { in: ['PAID', 'PARTIALLY_PAID'] },
        issueDate: { gte: from, lte: to },
        deletedAt: null,
      },
      _sum: { paidAmount: true },
    }),
    // Revenue last period
    prisma.invoice.aggregate({
      where: {
        organizationId: orgId,
        status: { in: ['PAID', 'PARTIALLY_PAID'] },
        issueDate: { gte: lastFrom, lte: lastTo },
        deletedAt: null,
      },
      _sum: { paidAmount: true },
    }),
    prisma.client.count({ where: { organizationId: orgId, status: 'ACTIVE', deletedAt: null } }),
    prisma.client.count({
      where: { organizationId: orgId, createdAt: { gte: from, lte: to }, deletedAt: null },
    }),
    prisma.dSREntry.count({
      where: { organizationId: orgId, status: 'SUBMITTED', deletedAt: null },
    }),
    prisma.dSREntry.count({
      where: {
        organizationId: orgId,
        status: { in: ['SUBMITTED', 'APPROVED'] },
        reportDate: { gte: from, lte: to },
        deletedAt: null,
      },
    }),
    prisma.invoice.aggregate({
      where: {
        organizationId: orgId,
        status: { in: ['ISSUED', 'PARTIALLY_PAID', 'OVERDUE'] },
        deletedAt: null,
      },
      _sum: { grandTotal: true, paidAmount: true },
    }),
    prisma.payment.aggregate({
      where: {
        organizationId: orgId,
        paymentDate: { gte: from, lte: to },
        deletedAt: null,
      },
      _sum: { amount: true },
    }),
    prisma.user.count({ where: { organizationId: orgId, isActive: true, deletedAt: null } }),
    // Top reps by revenue
    prisma.invoice.groupBy({
      by: ['createdById'],
      where: {
        organizationId: orgId,
        issueDate: { gte: from, lte: to },
        deletedAt: null,
        createdById: { not: null },
      },
      _sum: { grandTotal: true },
      orderBy: { _sum: { grandTotal: 'desc' } },
      take: 5,
    }),
    prisma.dSREntry.findMany({
      where: { organizationId: orgId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 8,
      select: {
        id: true,
        status: true,
        grandTotal: true,
        reportDate: true,
        submittedBy: { select: { id: true, name: true } },
        client: { select: { id: true, companyName: true } },
      },
    }),
    prisma.invoice.groupBy({
      by: ['status'],
      where: { organizationId: orgId, deletedAt: null },
      _count: true,
    }),
    prisma.salesTarget.findMany({
      where: {
        organizationId: orgId,
        scope: 'ORGANIZATION',
        isActive: true,
        deletedAt: null,
        periodStart: { lte: to },
        periodEnd: { gte: from },
      },
      take: 3,
      select: { name: true, targetValue: true, achievedValue: true, type: true },
    }),
  ])

  // Revenue trend (last 6 months)
  const revenueTrend = await Promise.all(
    Array.from({ length: 6 }).map(async (_, i) => {
      const now = new Date()
      const d = subMonths(now, 5 - i)
      const agg = await prisma.invoice.aggregate({
        where: {
          organizationId: orgId,
          issueDate: { gte: startOfMonth(d), lte: endOfMonth(d) },
          deletedAt: null,
        },
        _sum: { grandTotal: true },
      })
      return { name: format(d, 'MMM yy'), revenue: Number(agg._sum.grandTotal ?? 0) }
    })
  )

  // Enrich top reps with names
  const repIds = topReps.map((r) => r.createdById!).filter(Boolean)
  const repUsers = repIds.length
    ? await prisma.user.findMany({
        where: { id: { in: repIds } },
        select: { id: true, name: true, avatar: true },
      })
    : []

  const thisRev = Number(totalRevenue._sum.paidAmount ?? 0)
  const lastRev = Number(lastMonthRevenue._sum.paidAmount ?? 0)
  const outstanding =
    Number(outstandingInvoices._sum.grandTotal ?? 0) -
    Number(outstandingInvoices._sum.paidAmount ?? 0)

  const data = {
    kpis: {
      totalRevenue: thisRev,
      revenueTrend: lastRev > 0 ? ((thisRev - lastRev) / lastRev) * 100 : 0,
      activeClients,
      newClients,
      pendingDSRs,
      submittedDSRs,
      outstanding: Math.max(outstanding, 0),
      collectedThisMonth: Number(collectedThisMonth._sum.amount ?? 0),
      teamSize,
    },
    revenueTrend,
    invoiceStatusDist: invoiceStatusDist.map((s) => ({ name: s.status, value: s._count })),
    topReps: topReps.map((r, i) => {
      const u = repUsers.find((u) => u.id === r.createdById)
      return {
        rank: i + 1,
        id: r.createdById ?? '',
        name: u?.name ?? 'Unknown',
        avatar: u?.avatar,
        value: Number(r._sum.grandTotal ?? 0),
      }
    }),
    recentDSRs,
    targets: targets.map((t) => ({
      name: t.name,
      target: Number(t.targetValue),
      achieved: Number(t.achievedValue),
      type: t.type,
    })),
  }

  await cacheSet(cacheKey, data)
  return NextResponse.json(data)
}
