import { withTenantApi } from '@/lib/api-helpers'
import { prisma, Prisma } from '@/lib/prisma'
import { cacheGet, cacheSet, dashboardKey } from '@/lib/dashboard-cache'
import { subMonths, startOfMonth, format, endOfDay } from 'date-fns'

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

    // H-1: AR Aging — single SQL aggregate, no row scan in Node.js
    const agingRaw = await prisma.$queryRaw<
      [{ b1: string | null; b2: string | null; b3: string | null; b4: string | null }]
    >(
      Prisma.sql`
        SELECT
          SUM(CASE
            WHEN ("dueDate" IS NULL OR NOW() - "dueDate" <= INTERVAL '30 days')
              AND ("grandTotal" - "paidAmount") > 0
            THEN ("grandTotal" - "paidAmount") ELSE 0 END)::text AS b1,
          SUM(CASE
            WHEN "dueDate" IS NOT NULL
              AND NOW() - "dueDate" > INTERVAL '30 days'
              AND NOW() - "dueDate" <= INTERVAL '60 days'
              AND ("grandTotal" - "paidAmount") > 0
            THEN ("grandTotal" - "paidAmount") ELSE 0 END)::text AS b2,
          SUM(CASE
            WHEN "dueDate" IS NOT NULL
              AND NOW() - "dueDate" > INTERVAL '60 days'
              AND NOW() - "dueDate" <= INTERVAL '90 days'
              AND ("grandTotal" - "paidAmount") > 0
            THEN ("grandTotal" - "paidAmount") ELSE 0 END)::text AS b3,
          SUM(CASE
            WHEN "dueDate" IS NOT NULL
              AND NOW() - "dueDate" > INTERVAL '90 days'
              AND ("grandTotal" - "paidAmount") > 0
            THEN ("grandTotal" - "paidAmount") ELSE 0 END)::text AS b4
        FROM "Invoice"
        WHERE "organizationId" = ${orgId}::uuid
          AND "status" IN ('OVERDUE', 'ISSUED', 'PARTIALLY_PAID')
          AND "deletedAt" IS NULL
      `
    )
    const ar = agingRaw[0] ?? { b1: null, b2: null, b3: null, b4: null }

    // Monthly cash flow — 2 queries (one for invoices, one for payments) covering 6 months
    const sixMonthsAgo = startOfMonth(subMonths(now, 5))
    const [invMonthly, payMonthly] = await Promise.all([
      prisma.$queryRaw<{ month: string; invoiced: string }[]>(
        Prisma.sql`
          SELECT TO_CHAR(DATE_TRUNC('month', "issueDate"), 'Mon YY') AS month,
                 SUM("grandTotal")::text AS invoiced
          FROM "Invoice"
          WHERE "organizationId" = ${orgId}::uuid
            AND "issueDate" >= ${sixMonthsAgo}
            AND "deletedAt" IS NULL
          GROUP BY DATE_TRUNC('month', "issueDate")
          ORDER BY DATE_TRUNC('month', "issueDate")
        `
      ),
      prisma.$queryRaw<{ month: string; collected: string }[]>(
        Prisma.sql`
          SELECT TO_CHAR(DATE_TRUNC('month', "paymentDate"), 'Mon YY') AS month,
                 SUM("amount")::text AS collected
          FROM "Payment"
          WHERE "organizationId" = ${orgId}::uuid
            AND "paymentDate" >= ${sixMonthsAgo}
            AND "deletedAt" IS NULL
          GROUP BY DATE_TRUNC('month', "paymentDate")
          ORDER BY DATE_TRUNC('month', "paymentDate")
        `
      ),
    ])

    // Build a full 6-month series filling zeros for months with no data
    const cashFlow = Array.from({ length: 6 }).map((_, i) => {
      const d = subMonths(now, 5 - i)
      const label = format(d, 'MMM yy')
      const inv = invMonthly.find((r) => r.month === label)
      const pay = payMonthly.find((r) => r.month === label)
      return {
        name: label,
        invoiced: Number(inv?.invoiced ?? 0),
        collected: Number(pay?.collected ?? 0),
      }
    })

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
        { name: '0-30 days', value: Math.round(Number(ar.b1 ?? 0)) },
        { name: '31-60 days', value: Math.round(Number(ar.b2 ?? 0)) },
        { name: '61-90 days', value: Math.round(Number(ar.b3 ?? 0)) },
        { name: '90+ days', value: Math.round(Number(ar.b4 ?? 0)) },
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
