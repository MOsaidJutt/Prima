import { withTenantApi } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'
import { cacheGet, cacheSet, dashboardKey } from '@/lib/dashboard-cache'
import { subMonths, startOfMonth, endOfMonth, format, startOfDay, endOfDay } from 'date-fns'

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
      'financial',
      `${from.toISOString().slice(0, 10)}_${to.toISOString().slice(0, 10)}`
    )
    const cached = await cacheGet(cacheKey)
    if (cached)
      return new Response(JSON.stringify(cached), {
        headers: { 'Content-Type': 'application/json' },
      }) as never

    const now = new Date()

    const [totalInvoiced, collected, outstanding, overdue, paymentMethodDist, overdueInvoices] =
      await Promise.all([
        prisma.invoice.aggregate({
          where: { organizationId: orgId, issueDate: { gte: from, lte: to }, deletedAt: null },
          _sum: { grandTotal: true },
        }),
        prisma.payment.aggregate({
          where: { organizationId: orgId, paymentDate: { gte: from, lte: to }, deletedAt: null },
          _sum: { amount: true },
        }),
        prisma.invoice.aggregate({
          where: {
            organizationId: orgId,
            status: { in: ['ISSUED', 'PARTIALLY_PAID'] },
            deletedAt: null,
          },
          _sum: { grandTotal: true, paidAmount: true },
        }),
        prisma.invoice.aggregate({
          where: { organizationId: orgId, status: 'OVERDUE', deletedAt: null },
          _sum: { grandTotal: true, paidAmount: true },
        }),
        prisma.payment.groupBy({
          by: ['method'],
          where: { organizationId: orgId, paymentDate: { gte: from, lte: to }, deletedAt: null },
          _sum: { amount: true },
        }),
        prisma.invoice.findMany({
          where: { organizationId: orgId, status: 'OVERDUE', deletedAt: null },
          orderBy: { dueDate: 'asc' },
          take: 10,
          select: {
            id: true,
            invoiceNumber: true,
            grandTotal: true,
            paidAmount: true,
            dueDate: true,
            client: { select: { id: true, companyName: true } },
          },
        }),
      ])

    // AR Aging buckets (overdue invoices split by days overdue)
    const overdueAll = await prisma.invoice.findMany({
      where: {
        organizationId: orgId,
        status: { in: ['OVERDUE', 'ISSUED', 'PARTIALLY_PAID'] },
        deletedAt: null,
      },
      select: { grandTotal: true, paidAmount: true, dueDate: true },
    })

    const aging = { '0-30': 0, '31-60': 0, '61-90': 0, '90+': 0 }
    for (const inv of overdueAll) {
      if (!inv.dueDate) continue
      const daysOverdue = Math.floor((now.getTime() - inv.dueDate.getTime()) / 86400000)
      const outstanding = Number(inv.grandTotal) - Number(inv.paidAmount)
      if (outstanding <= 0) continue
      if (daysOverdue <= 0) aging['0-30'] += outstanding
      else if (daysOverdue <= 30) aging['0-30'] += outstanding
      else if (daysOverdue <= 60) aging['31-60'] += outstanding
      else if (daysOverdue <= 90) aging['61-90'] += outstanding
      else aging['90+'] += outstanding
    }

    // Monthly cash flow (last 6 months)
    const cashFlow = await Promise.all(
      Array.from({ length: 6 }).map(async (_, i) => {
        const d = subMonths(now, 5 - i)
        const [inv, pay] = await Promise.all([
          prisma.invoice.aggregate({
            where: {
              organizationId: orgId,
              issueDate: { gte: startOfMonth(d), lte: endOfMonth(d) },
              deletedAt: null,
            },
            _sum: { grandTotal: true },
          }),
          prisma.payment.aggregate({
            where: {
              organizationId: orgId,
              paymentDate: { gte: startOfMonth(d), lte: endOfMonth(d) },
              deletedAt: null,
            },
            _sum: { amount: true },
          }),
        ])
        return {
          name: format(d, 'MMM yy'),
          invoiced: Number(inv._sum.grandTotal ?? 0),
          collected: Number(pay._sum.amount ?? 0),
        }
      })
    )

    const outstandingAmt =
      Number(outstanding._sum.grandTotal ?? 0) - Number(outstanding._sum.paidAmount ?? 0)
    const overdueAmt = Number(overdue._sum.grandTotal ?? 0) - Number(overdue._sum.paidAmount ?? 0)

    const data = {
      kpis: {
        totalInvoiced: Number(totalInvoiced._sum.grandTotal ?? 0),
        collected: Number(collected._sum.amount ?? 0),
        outstanding: Math.max(outstandingAmt, 0),
        overdue: Math.max(overdueAmt, 0),
        collectionRate:
          Number(totalInvoiced._sum.grandTotal ?? 0) > 0
            ? (Number(collected._sum.amount ?? 0) / Number(totalInvoiced._sum.grandTotal ?? 0)) *
              100
            : 0,
      },
      cashFlow,
      aging: [
        { name: '0-30 days', value: aging['0-30'] },
        { name: '31-60 days', value: aging['31-60'] },
        { name: '61-90 days', value: aging['61-90'] },
        { name: '90+ days', value: aging['90+'] },
      ],
      paymentMethodDist: paymentMethodDist.map((p) => ({
        name: p.method,
        value: Number(p._sum.amount ?? 0),
      })),
      overdueInvoices: overdueInvoices.map((inv) => ({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        client: inv.client.companyName,
        grandTotal: Number(inv.grandTotal),
        paidAmount: Number(inv.paidAmount),
        outstanding: Number(inv.grandTotal) - Number(inv.paidAmount),
        dueDate: inv.dueDate,
        daysOverdue: inv.dueDate
          ? Math.floor((now.getTime() - inv.dueDate.getTime()) / 86400000)
          : 0,
      })),
    }

    await cacheSet(cacheKey, data)
    return new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json' },
    }) as never
  })
}
